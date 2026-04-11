/* =============================================
   CORE LOGIC — Ethereal Voyager
   ============================================= */

const API_CONFIG = {
  BASE_URL: 'data',  // ← 改为相对路径 data
  USE_MOCK: false
};

const APP_STATE = {
  monitors: JSON.parse(localStorage.getItem('hjt_monitors')) || null,
  isSubscribed: localStorage.getItem('hjt_subscribed') === 'true',
  currentResults: [], 
  currentSearchData: null, // 新增：保存完整的搜索数据（包含趋势）
  filters: { price: [], airlines: [] },
  sort: 'price-asc'
};

function saveAppState() {
  localStorage.setItem('hjt_monitors', JSON.stringify(APP_STATE.monitors));
  localStorage.setItem('hjt_subscribed', APP_STATE.isSubscribed);
}

/* =============================================
   DATA FETCHING
   ============================================= */
async function fetchData(endpoint) {
  if (API_CONFIG.USE_MOCK) return null;
  try {
    const url = API_CONFIG.BASE_URL + '/' + endpoint;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('[API] 请求失败，使用兜底数据:', endpoint, e);
    return null;
  }
}

async function getDeals() { return (await fetchData('deals.json')) || MOCK.deals; }

async function getSearch(from, to) { 
  let data = await fetchData(`search/${from}-${to}.json`);
  if (!data) {
    data = JSON.parse(JSON.stringify(MOCK.search));
    const fromCity = CITY_MAP[from.toUpperCase()] || from;
    const toCity = CITY_MAP[to.toUpperCase()] || to;
    data.route.from.city = fromCity;
    data.route.to.city = toCity;
    data.route.from.code = from.toUpperCase();
    data.route.to.code = to.toUpperCase();
    
    const seed = (from + to).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    data.flights.forEach((f, i) => {
        let offset = (seed * 13 + i * 293) % 1500 - 400; 
        f.price = Math.max(500, f.price + offset);
        f.originalPrice = f.price + 1200 + (seed % 800);
        f.durationText = `${2 + (seed%8)} 小时 ${((seed*i)%50)+10} 分`;
        f.departure.airport = fromCity + (seed % 2 === 0 ? '国际机场' : '机场');
        f.arrival.airport = toCity + (seed % 2 === 0 ? '国际机场' : '机场');
        f.departure.code = from.toUpperCase();
        f.arrival.code = to.toUpperCase();
    });
    if(data.trend) {
        data.trend.lowestPrice = Math.min(...data.flights.map(f=>f.price));
        // 动态生成趋势柱状图数据，增加真实感
        data.trend.bars = Array.from({length: 15}, (_, i) => {
            const isToday = i === 12;
            const price = data.trend.lowestPrice + Math.floor(Math.random() * 800);
            return {
                day: isToday ? '今天' : (i + 1).toString(),
                height: 30 + Math.floor(Math.random() * 60),
                price: price,
                date: `04-${(i + 1).toString().padStart(2, '0')}`,
                isToday: isToday,
                isLowest: price === data.trend.lowestPrice
            };
        });
    }
  }
  return data;
}

async function getFlightDetail(id) { return (await fetchData(`flights/${id}.json`)) || MOCK.detail; }

async function getMonitors() { 
  if (APP_STATE.monitors) return { monitors: APP_STATE.monitors };
  const data = (await fetchData('monitors.json')) || MOCK.monitors;
  APP_STATE.monitors = data.monitors;
  saveAppState();
  return data;
}

/* =============================================
   RENDER FUNCTIONS
   ============================================= */

function getTagClass(tag) {
  if (tag.includes('直飞')) return 'direct';
  if (tag.includes('可退') || tag.includes('可改')) return 'good';
  if (tag.includes('不可退') || tag.includes('不可改') || tag.includes('不含')) return 'warn';
  if (tag.includes('含托运') || tag.includes('含行李')) return 'good';
  if (tag.includes('税费')) return 'tax';
  return 'refund';
}

function renderDeals(data) {
  const container = document.getElementById('deals-container');
  if (!container) return;
  container.innerHTML = (data.deals || data.items || []).map(d => `
    <div class="deal-card" onclick="openBooking('${d.bookingUrl}')">
      <div class="deal-card-img">
        <img src="${d.imageUrl}" alt="${d.to.city}" onerror="this.onerror=null; this.src='https://picsum.photos/seed/${encodeURIComponent(d.to.city)}/800/600';">
        <span class="discount-badge">${d.discount}</span>
        <span class="source-badge">来自${d.source}</span>
      </div>
      <div class="deal-card-body">
        <div class="deal-route">
          <div>
            <h3>${d.from.city} → ${d.to.city}</h3>
            <div class="deal-date">${d.departDate} · ${d.airline}</div>
          </div>
          <div class="deal-price">
            <div class="current">¥${d.price.toLocaleString()}</div>
            <div class="original">均价 ¥${d.originalPrice.toLocaleString()}</div>
          </div>
        </div>
        <div class="deal-tags">
          ${d.tags.map(t => `<span class="deal-tag ${getTagClass(t)}">${t}</span>`).join('')}
          ${d.hotTag ? `<span class="deal-tag hot">${d.hotTag}</span>` : ''}
        </div>
        ${d.recommendation ? `<div class="deal-recommendation"><span class="rec-tag">${d.recommendation}</span>${d.recommendationReason}</div>` : ''}
        ${d.priceStatus ? `<div class="deal-status"><div class="deal-status-fill" style="width:${d.priceStatusPercent||25}%"></div><span>${d.priceStatus}</span></div>` : ''}
        <div class="deal-meta"><span>来自${d.source}</span><span>去${d.source}查看 ↗</span></div>
      </div>
    </div>
  `).join('');
  const timeEl = document.getElementById('deals-update-time');
  if (data.updatedAt && timeEl) {
    timeEl.innerHTML = '数据更新于 ' + new Date(data.updatedAt).toLocaleString('zh-CN') + '<span class="source-disclaimer" style="margin-left:1rem;">价格以下游平台实时页为准</span>';
  }
}

function renderTrend(trend, conclusion, priceHistory) {
  const bars = priceHistory || trend?.bars || [];
  const hint = trend?.hint || '实时低价探测中';
  const lowest = trend?.lowestPrice || (bars.length ? Math.min(...bars.map(b => b.price)) : 0);
  
  return `
    ${conclusion ? `<div class="trend-conclusion"><span class="material-symbols-outlined">trending_down</span>${conclusion}</div>` : ''}
    <div class="trend-header">
      <div><h3>价格走势</h3><div class="trend-hint">${hint}</div></div>
      <div class="price"><div class="price-label">最低价格</div><div class="price-value">¥${lowest.toLocaleString()}</div></div>
    </div>
    <div class="trend-chart">
      ${bars.length ? bars.map(b => {
        const p = b.price || trend.lowestPrice || 0;
        const d = b.date || b.day || '';
        return `<div class="trend-bar-wrap ${b.isToday?'today':''}"><div class="trend-bar ${b.isLowest?'lowest':''}" style="height:${b.height}%"><div class="trend-tooltip">¥${p.toLocaleString()}<br/>${d}</div></div></div>`;
      }).join('') : '<div style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--outline); font-size:0.8rem;">正在同步最新历史价格...</div>'}
    </div>`;
}

function renderFlights(data) {
  const trendBox = document.getElementById('trend-container');
  // 优先尝试从搜索结果的第一条中提取历史（模拟真实感），或者直接用 data.trend
  const hist = data.flights?.[0]?.priceHistory || data.priceHistory;
  if (trendBox) trendBox.innerHTML = renderTrend(data.trend, data.trendConclusion, hist);
  
  const container = document.getElementById('flights-container');
  if (!container) return;
  
  if (data.flights.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:4rem;grid-column:1/-1;color:var(--outline);">
      <span class="material-symbols-outlined" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;">search_off</span>
      <p>未找到符合条件的航班，请尝试调整筛选条件</p>
    </div>`;
    return;
  }
  container.innerHTML = data.flights.map(f => {
    const badgeClass = f.badgeType === 'cheapest' ? 'cheapest' : (f.badgeType === 'safest' ? 'safest' : (f.badgeType === 'business' ? 'business' : ''));
    const btnText = f.source ? `去${f.source}查看 ↗` : '查看详情';
    return `
    <div class="flight-card" onclick="showFlightDetail('${f.id}')">
      ${f.badge ? `<div class="flight-card-badge ${badgeClass}">${f.badge}</div>` : ''}
      <div class="fc-airline">
        <div class="fc-airline-logo">
          <img src="https://img.logo.dev/${encodeURIComponent(f.airline)}?token=placeholder&size=100" 
               alt="${f.airline}" class="fc-airline-img" 
               onerror="this.onerror=null; this.src='https://picsum.photos/seed/${encodeURIComponent(f.airline + 'logo')}/100/100';">
        </div>
        <div>
          <div class="fc-airline-name">${f.airline}</div>
          <div class="fc-airline-detail">${f.flightNo} | ${f.aircraft}</div>
          ${f.recommendationReason ? `<div class="fc-rec-reason"><span class="material-symbols-outlined">tips_and_updates</span>${f.recommendationReason}</div>` : `<div class="fc-source">来自${f.source}</div>`}
          ${f.tags ? `<div class="fc-tags">${f.tags.map(t => `<span class="fc-tag ${getTagClass(t)}">${t}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="fc-times">
        <div class="fc-time"><div class="fc-time-value">${f.departure.time}</div><div class="fc-time-airport">${f.departure.airport}</div></div>
        <div class="fc-duration">
          <div class="fc-duration-text">${f.durationText}</div>
          <div class="fc-duration-line"><span class="material-symbols-outlined detail-flight-icon" style="font-size:1rem;top:-8px;">flight</span></div>
          ${f.onTimeRate ? `<div class="fc-duration-rate ${f.onTimeRate>=90?'good':f.onTimeRate>=80?'mid':'bad'}">准点率 ${f.onTimeRate}%</div>` : ''}
        </div>
        <div class="fc-time"><div class="fc-time-value">${f.arrival.time}</div><div class="fc-time-airport">${f.arrival.airport}</div></div>
      </div>
      <div class="fc-right">
        <div class="fc-services">
          ${(f.services||[]).map(s => `<div class="fc-service ${s.available?'':'unavailable'}"><span class="material-symbols-outlined">${s.icon}</span><span>${s.label}</span></div>`).join('')}
        </div>
        ${f.originalPrice ? `<div class="fc-price-old">¥${f.originalPrice.toLocaleString()}</div>` : ''}
        <div class="fc-price">¥${f.price.toLocaleString()}</div>
        <button class="fc-book" onclick="event.stopPropagation(); openBooking('${f.bookingUrl}')">${btnText}</button>
        <div class="fc-updated">来自${f.source} · 价格以平台实时页为准</div>
      </div>
    </div>
  `}).join('');
}

function renderDetail(data) {
  const f = data.flight;
  const rulesKeys = Object.keys(f.rules);
  const container = document.getElementById('detail-container');
  if (!container) return;
  container.innerHTML = `
    <div class="detail-top">
      <div>
        <div class="detail-flight-card">
          <div class="detail-flight-header">
            <div class="detail-port">
              <div class="detail-port-code">出发 · ${f.departure.code}</div>
              <div class="detail-port-time">${f.departure.time}</div>
              <div class="detail-port-name">${f.departure.airport} ${f.departure.terminal}</div>
            </div>
            <div class="detail-flight-line">
              <div class="detail-flight-duration">${f.durationText} · ${f.direct?'直飞':'转机'}</div>
              <div class="detail-flight-track" style="width:100%;"><span class="material-symbols-outlined detail-flight-icon">flight</span></div>
              <div class="detail-flight-info"><strong>${f.airline} ${f.flightNo}</strong> · ${f.aircraft}</div>
            </div>
            <div class="detail-port">
              <div class="detail-port-code">到达 · ${f.arrival.code}</div>
              <div class="detail-port-time">${f.arrival.time}</div>
              <div class="detail-port-name">${f.arrival.airport} ${f.arrival.terminal}</div>
            </div>
          </div>
        </div>
        <div class="rules-section">
          <div class="rules-title"><span class="material-symbols-outlined">verified_user</span>规则透明化</div>
          <div class="rules-grid">
            ${rulesKeys.map(k => { const r = f.rules[k]; return `
              <div class="rule-card">
                <div class="rule-icon"><span class="material-symbols-outlined">${r.icon}</span></div>
                <h4>${r.title}</h4>
                <p>${r.detail.replace(/\n/g,'<br/>')}</p>
              </div>`; }).join('')}
          </div>
          <div class="trust-tags">
            <span class="trust-tag"><span class="material-symbols-outlined">bolt</span> 出票极速</span>
            <span class="trust-tag"><span class="material-symbols-outlined">verified</span> 官方认证航司</span>
            <span class="trust-tag"><span class="material-symbols-outlined">visibility</span> 无隐形消费</span>
          </div>
        </div>
      </div>
      <div class="detail-sidebar">
        <div class="price-card">
          <span class="price-card-badge">${f.bestPriceBadge||'最佳票价'}</span>
          <div class="original">¥${f.originalPrice.toLocaleString()}</div>
          <div class="cabin">${f.cabin}</div>
          <div class="amount">¥${f.price.toLocaleString()}</div>
          <a class="btn-book" href="${f.bookingUrl}" target="_blank" rel="noopener">去${f.source||'携程'}查看 ↗</a>
          <div class="seats-left">仅剩 ${f.seatsLeft} 张此价格 · 价格以${f.source||'携程'}实时页为准</div>
          <div class="price-breakdown">
            <div class="price-row"><span>票价总计</span><span>¥${f.priceBreakdown.base.toLocaleString()}</span></div>
            <div class="price-row"><span>燃油/税费</span><span>¥${f.priceBreakdown.tax.toLocaleString()}</span></div>
            <div class="price-row total"><span>实付总额</span><span>¥${f.priceBreakdown.total.toLocaleString()}</span></div>
          </div>
          <div class="source-disclaimer" style="text-align:center;margin-top:0.75rem;">数据更新于 ${new Date(f.updatedAt || Date.now()).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · 来自${f.source||'携程'}</div>
        </div>
        <div class="alert-card" onclick="addMonitorFromDetail()">
          <div class="alert-icon"><span class="material-symbols-outlined icon-filled">notifications_active</span></div>
          <div class="alert-text"><h4>降价提醒</h4><p>该航线价格波动较大，建议开启监控</p></div>
          <div class="alert-add"><span class="material-symbols-outlined" style="font-size:1rem;">add</span></div>
        </div>
      </div>
    </div>
    <div class="detail-bottom">
      <div class="detail-trend-card">
        <div class="trend-conclusion"><span class="material-symbols-outlined">trending_down</span>当前价格低于近 30 天均价，建议尽早锁票</div>
        <div class="trend-header">
          <div><h3>价格趋势</h3><div style="font-size:0.8rem;color:var(--outline);margin-top:0.15rem;">近 30 天价格走势</div></div>
          <div class="price"><div class="price-label">历史最低</div><div class="price-value">¥${f.historicalLowest.toLocaleString()}</div></div>
        </div>
        <div class="trend-chart" style="height:100px;margin-top:1.5rem;">
          ${(f.priceTrend||[]).map(p => `<div class="trend-bar-wrap ${p.isToday?'today':''}"><div class="trend-bar ${p.isToday?'today':p.isLowest?'low':''}" style="height:${p.height}%"></div></div>`).join('')}
        </div>
      </div>
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;margin-bottom:1.25rem;">相似航线推荐</h3>
        <div class="similar-list">
          ${(f.similarRoutes||[]).map(s => `
            <div class="similar-item" onclick="openBooking('${s.bookingUrl}')">
              <div class="similar-thumb"><img src="${s.imageUrl}" alt="${s.toCity}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80';" /></div>
              <div class="similar-info"><h4>${s.from} → ${s.toCity} ${s.to}</h4><p>${s.date} · ${s.info}</p></div>
              <div class="similar-price"><div class="label">起价</div><div class="value">¥${s.price.toLocaleString()}</div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function renderMonitors(data) {
  const container = document.getElementById('monitors-container');
  if (!container) return;
  let html = data.monitors.map(m => {
    const isHighlight = m.highlight || m.status === 'near_target';
    const priceColor = m.status === 'below_target' ? '#2e7d32' : (m.status === 'near_target' ? 'var(--tertiary-fixed-dim)' : 'var(--tertiary-accent)');
    const actionText = m.status === 'below_target' ? '去查看 ↗' : (m.status === 'near_target' ? '去查看 ↗' : '修改监控');
    return `
      <div class="monitor-card ${isHighlight?'highlight':''}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="monitor-icon" style="margin-bottom:0;"><span class="material-symbols-outlined">flight_takeoff</span></div>
            ${m.badge ? `<span class="monitor-badge" style="position:static; margin:0; padding:0.25rem 0.65rem;">${m.badge}</span>` : ''}
          </div>
          <button onclick="removeMonitor(this)" title="取消监控" style="background:none;border:none;color:var(--outline-variant);cursor:pointer;padding:0.25rem;border-radius:4px;transition:all 0.2s;" onmouseover="this.style.color='#d32f2f';this.style.background='rgba(211,47,47,0.08)'" onmouseout="this.style.color='var(--outline-variant)';this.style.background='none'">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
        <div class="monitor-route">${m.from.city} (${m.from.code}) → ${m.to.city} (${m.to.code})</div>
        <div class="monitor-airline">${m.airline}</div>
        <div class="monitor-prices">
          <div><div class="monitor-label">${isHighlight?'理想折扣价':'目标价'}</div><div class="monitor-target">¥${m.targetPrice.toLocaleString()}</div></div>
          <div><div class="monitor-label">${isHighlight?'今日最低':'当前价'}</div><div class="monitor-current" style="color:${priceColor}">¥${m.currentPrice.toLocaleString()}</div></div>
        </div>
        ${m.trend.length ? `<div class="monitor-trend">${m.trend.map((h,i) => `<div class="monitor-trend-bar ${i===m.trend.length-1?'current':''}" style="height:${h}%"></div>`).join('')}</div>` : ''}
        ${isHighlight ? `<div style="background:rgba(255,255,255,0.08);border-radius:var(--radius-sm);padding:0.75rem;margin-bottom:1rem;font-size:0.75rem;line-height:1.5;">接近目标价格！建议开启强提醒通知。</div>` : ''}
        <div class="monitor-footer">
          <span>${m.lastUpdated ? '最后更新: '+m.lastUpdated : ''}</span>
          <span class="monitor-action" onclick="openBooking('${m.bookingUrl}')">${actionText}</span>
        </div>
      </div>`;
  }).join('');
  html += `<div class="monitor-add" onclick="showToast('添加监控功能即将上线')"><span class="material-symbols-outlined">add_circle_outline</span><h4>开启新航线监控</h4><p>订阅您下次旅行的航线，获取第一手降价情报</p></div>`;
  container.innerHTML = html;
  const sDeals = document.getElementById('stat-deals');
  const sPartners = document.getElementById('stat-partners');
  if (sDeals) sDeals.textContent = (data.stats?.todayDeals || 8429).toLocaleString();
  if (sPartners) sPartners.textContent = (data.stats?.partners || 120) + '+';
}

/* =============================================
   ACTIONS
   ============================================= */
function openBooking(url) {
  if (url) window.open(url, '_blank', 'noopener');
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // 统一处理导航链接激活状态
  const navExp = document.getElementById('nav-explore');
  const navSub = document.getElementById('nav-subscription');
  
  if (page === 'home') {
    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (navExp) navExp.classList.toggle('active', activeTab === 'tab-explore');
    if (navSub) navSub.classList.toggle('active', activeTab === 'tab-monitor');
  } else {
    if (navExp) navExp.classList.remove('active');
    if (navSub) navSub.classList.remove('active');
  }

  if (page === 'profile') renderProfileStats();
}

function renderProfileStats() {
  const monitors = APP_STATE.monitors || [];
  const monEl = document.getElementById('prof-monitors');
  if (monEl) monEl.textContent = (monitors.length || 0) + ' 条';
  
  const subEl = document.getElementById('prof-sub');
  if (subEl) {
    subEl.textContent = APP_STATE.isSubscribed ? '已开启' : '未开启';
    subEl.style.color = APP_STATE.isSubscribed ? 'var(--secondary)' : 'var(--outline)';
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  
  const navExp = document.getElementById('nav-explore');
  const navSub = document.getElementById('nav-subscription');
  
  if (navExp) navExp.classList.toggle('active', tab === 'explore');
  if (navSub) navSub.classList.toggle('active', tab === 'monitor');
  
  const chips = document.getElementById('home-chips');
  if(chips) chips.style.display = tab === 'explore' ? 'flex' : 'none';
}

async function filterDeals(el) {
  document.querySelectorAll('#home-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');

  const container = document.getElementById('deals-container');
  if (!container) return;
  
  container.style.transition = 'opacity 0.15s ease';
  container.style.opacity = '0';
  
  const data = await getDeals();
  const rawDeals = JSON.parse(JSON.stringify(data.deals || data.items || []));
  let deals = rawDeals;
  const chipText = el.innerText.trim();
  
  if(chipText === '国内精选') {
    deals = rawDeals.filter(d => d.region === 'domestic');
  } else if(chipText === '国际大促') {
    deals = rawDeals.filter(d => d.region === 'intl');
  } else if(chipText === '直飞特惠') {
    deals = rawDeals.filter(d => d.tags.includes('直飞'));
  } else if(chipText === '本周末') {
    const today = new Date();
    deals = rawDeals.filter(d => {
       const dd = new Date(d.departDate);
       return dd.getDay() === 6 || dd.getDay() === 0; // 周六或周日
    });
  } else if(chipText === '说走就走') {
    deals = rawDeals.filter(d => d.tags.includes('立刻出发') || d.tags.includes('尾单特价') || d.tags.includes('极速出票'));
  }
  
  // 保持随机排序增加发现感，但不再篡改地名
  deals = deals.sort(() => Math.random() - 0.5).slice(0, 6);

  renderDeals({ deals: deals });
  container.style.opacity = '1';
}

async function doSearch() {
  const fromInput = document.getElementById('input-from')?.value;
  const toInput = document.getElementById('input-to')?.value;
  
  const from = (fromInput || 'SHA').trim();
  const to = (toInput || 'PEK').trim();
  const toCity = CITY_MAP[to.toUpperCase()] || to;
  
  // 动态设置搜索页 Hero 背景图
  const bg = document.getElementById('results-hero-bg');
  if (bg) {
    const seed = encodeURIComponent(toCity);
    bg.style.backgroundImage = `url('https://picsum.photos/seed/${seed}/1600/900')`;
    // 异步尝试换成更高质的 Unsplash（如有）
    const curatedIds = {
      '北京': '1508804100515-570bbd72a4b0', // 故宫/长城地标
      '上海': '1474181487828-5fe9a4ae19b2', // 外滩
      '杭州': '1543097692-fa13c6cd8595', // 西湖
      '东京': '1503899036084-755ad26bc2aa', // 涩谷
      '大坂': '1540959733332-eab4deabeeaf', // 大阪城
      '巴黎': '1502602898657-3e91760cbb34', // 埃菲尔
      '伦敦': '1513635269975-59663e0ac1ad'  // 大本钟
    };
    if (curatedIds[toCity]) {
      const img = new Image();
      const unsplashUrl = `https://images.unsplash.com/photo-${curatedIds[toCity]}?w=1600&q=80`;
      img.src = unsplashUrl;
      img.onload = () => bg.style.backgroundImage = `url('${unsplashUrl}')`;
    }
  }

  navigateTo('results');
  
  const data = await getSearch(from, to);
  APP_STATE.currentResults = data.flights; 
  APP_STATE.currentSearchData = data; // 保存趋势数据
  applyFiltersAndSort();
}

function runFilterUI() {
  // 获取当前所有的筛选状态
  const priceChecks = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(i => i.closest('.filter-group')?.innerText.includes('价格'));
  const airlineChecks = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(i => i.closest('.filter-group')?.innerText.includes('航空'));
  
  APP_STATE.filters.price = priceChecks.filter(i => i.checked).map(i => i.nextElementSibling.innerText);
  APP_STATE.filters.airlines = airlineChecks.filter(i => i.checked).map(i => i.nextElementSibling.innerText);
  
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) APP_STATE.sort = sortSelect.value;
  
  applyFiltersAndSort();
  showToast('结果已更新');
}

function applyFiltersAndSort() {
  let results = [...APP_STATE.currentResults];
  
  // 1. 航空公司过滤
  if (APP_STATE.filters.airlines.length > 0) {
    results = results.filter(f => APP_STATE.filters.airlines.includes(f.airline));
  }
  
  // 2. 价格区间过滤
  if (APP_STATE.filters.price.length > 0) {
    results = results.filter(f => {
      if (APP_STATE.filters.price.includes('¥1000 以下') && f.price < 1000) return true;
      if (APP_STATE.filters.price.includes('¥1000 - ¥3000') && f.price >= 1000 && f.price <= 3000) return true;
      if (APP_STATE.filters.price.includes('¥3000 以上') && f.price > 3000) return true;
      return false;
    });
  }
  
  // 3. 排序逻辑
  results.sort((a, b) => {
    if (APP_STATE.sort === 'price-asc') return a.price - b.price;
    if (APP_STATE.sort === 'time-asc') return a.departure.time.replace(':', '') - b.departure.time.replace(':', '');
    if (APP_STATE.sort === 'duration-asc') {
        const getMin = (s) => (parseInt(s.split('h')[0])||0)*60 + (parseInt(s.includes('分') ? s.split('时')[1] : 0)||0);
        return getMin(a.durationText) - getMin(b.durationText);
    }
    return 0;
  });
  
  renderFlights({ 
    flights: results, 
    trend: APP_STATE.currentSearchData?.trend, 
    trendConclusion: APP_STATE.currentSearchData?.trendConclusion 
  });
}

function addMonitorFromDetail() {
  const f = window.currentDetailFlight;
  if(f) {
    addMonitor({
      from: f.departure.airport || f.departure.code,
      fromCode: f.departure.code,
      to: f.arrival.airport || f.arrival.code,
      toCode: f.arrival.code,
      airline: f.airline,
      currentPrice: f.price,
      targetPrice: Math.floor(f.price * 0.9)
    });
  }
}

function addMonitor(m) {
  if(!APP_STATE.monitors) APP_STATE.monitors = [];
  const exists = APP_STATE.monitors.some(item => item.from.code === m.fromCode && item.to.code === m.toCode);
  if(exists) {
    showToast('该航线已在监控列表中');
    return;
  }
  
  const newMonitor = {
    id: 'monitor_' + Date.now(),
    from: { code: m.fromCode || 'SHA', city: m.from || '上海' },
    to: { code: m.toCode || 'PEK', city: m.to || '北京' },
    airline: m.airline || '航司载入中',
    currentPrice: m.currentPrice || 2000,
    targetPrice: m.targetPrice || 1800,
    status: 'monitoring',
    trend: [60, 55, 65, 50, 45, 60, 55, 40],
    lastUpdated: '刚才',
    bookingUrl: '#'
  };
  
  APP_STATE.monitors.unshift(newMonitor);
  saveAppState();
  showToast('监控已开启，降价将第一时间通知您');
  
  const monitorTab = document.getElementById('tab-monitor');
  if(monitorTab && monitorTab.classList.contains('active')) {
    renderMonitors({ monitors: APP_STATE.monitors });
  }
}

function removeMonitor(btn) {
  const card = btn.closest('.monitor-card');
  if(card) {
    const routeText = card.querySelector('.monitor-route').innerText;
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      if(APP_STATE.monitors) {
        APP_STATE.monitors = APP_STATE.monitors.filter(m => `${m.from.city} (${m.from.code}) → ${m.to.city} (${m.to.code})` !== routeText);
        saveAppState();
      }
      card.remove();
      showToast('监控已取消');
    }, 300);
  }
}

async function showFlightDetail(id) {
  navigateTo('detail');
  const data = await getFlightDetail(id);
  window.currentDetailFlight = data.flight;
  renderDetail(data);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Check subscription status
  if(APP_STATE.isSubscribed) {
    const banner = document.querySelector('.cta-banner');
    if(banner) banner.style.display = 'none';
  }

  // 并行加载首页数据，大幅提升初始化速度
  const [deals, monitors, search] = await Promise.all([
    getDeals(),
    getMonitors(),
    getSearch('SHA', 'PEK')
  ]);

  renderDeals(deals);
  renderMonitors(monitors);
  renderFlights(search);

  // 滚动动画
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  setTimeout(() => {
    document.querySelectorAll('.deal-card, .monitor-card, .flight-card, .rule-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }, 20);
});

function toggleNotif() {
  const u = document.getElementById('user-dropdown');
  const n = document.getElementById('notif-dropdown');
  if (u) u.classList.remove('show');
  if (n) n.classList.toggle('show');
}

function toggleUserMenu() {
  const n = document.getElementById('notif-dropdown');
  const u = document.getElementById('user-dropdown');
  if (n) n.classList.remove('show');
  if (u) u.classList.toggle('show');
}

function clearNotifs() {
  const list = document.getElementById('notif-list');
  const btn = document.getElementById('notif-btn');
  const dd = document.getElementById('notif-dropdown');
  if (list) list.innerHTML = '<div class="notif-empty">已清空所有消息</div>';
  if (btn) btn.classList.remove('notif-badge');
  setTimeout(() => {
    if (dd) dd.classList.remove('show');
  }, 800);
}

function handleSubscribe() {
  const input = document.getElementById('sub-email');
  const btn = document.getElementById('sub-btn');
  if (!input || !input.value || !input.value.includes('@')) {
    showToast('请输入有效的邮箱地址');
    return;
  }
    btn.innerText = '已订阅';
    btn.style.background = '#2e7d32';
    btn.style.boxShadow = '0 4px 16px rgba(46,125,50,0.3)';
    APP_STATE.isSubscribed = true;
    saveAppState();
    showToast('订阅成功！我们将第一时间通知您');
    
    const banner = document.querySelector('.cta-banner');
    if (banner) {
      banner.style.transition = 'all 0.3s ease';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-10px)';
      setTimeout(() => banner.style.display = 'none', 300);
    }
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('notif-dropdown');
  const btn = document.getElementById('notif-btn');
  if (dropdown && dropdown.classList.contains('show') && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove('show');
  }
  const uDropdown = document.getElementById('user-dropdown');
  const uBtn = document.getElementById('user-menu-btn');
  if (uDropdown && uDropdown.classList.contains('show') && !uDropdown.contains(e.target) && !uBtn.contains(e.target)) {
    uDropdown.classList.remove('show');
  }
});
