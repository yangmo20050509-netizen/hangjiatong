/* =============================================
   CORE LOGIC — Hangjiatong
   ============================================= */

const API_CONFIG = {
  BASE_URL: 'data',
  USE_MOCK: false
};

const DEFAULT_SEARCH = {
  from: 'SHA',
  to: 'PEK',
  dateOffset: 7
};

const ROUTE_BACKGROUNDS = {
  北京: '1592620540259-75b9f6500187',
  上海: '1506158428131-737c30a3f44a',
  广州: '1563090162-6b4c2a20d658',
  深圳: '1523455823190-362c3f848fd2',
  成都: '1555160868-aba7945d4213',
  杭州: '1558422719-d6982435e4e4',
  重庆: '1524316230156-3ac40eea29a8',
  东京: '1503899036084-755ad26bc2aa',
  大阪: '1540959733332-eab4deabeeaf',
  巴黎: '1502602898657-3e91760cbb34'
};

const CITY_TO_CODE = Object.entries(CITY_MAP).reduce((map, [code, city]) => {
  if (!map[city]) map[city] = code;
  return map;
}, {});

const APP_STATE = {
  dealsData: null,
  monitors: JSON.parse(localStorage.getItem('hjt_monitors') || 'null'),
  monitorStats: null,
  isSubscribed: localStorage.getItem('hjt_subscribed') === 'true',
  currentSearchData: null,
  currentResults: [],
  currentDetailFlight: null,
  filters: {
    price: [],
    airlines: [],
    stops: [],
    baggage: []
  },
  sort: 'recommend'
};

function saveAppState() {
  localStorage.setItem('hjt_monitors', JSON.stringify(APP_STATE.monitors || []));
  localStorage.setItem('hjt_subscribed', APP_STATE.isSubscribed ? 'true' : 'false');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueStrings(list) {
  return [...new Set(safeArray(list).filter(Boolean))];
}

function getRecommendedDate(offsetDays = DEFAULT_SEARCH.dateOffset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateString, offsetDays) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function normalizeDateInput(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  parsed.setHours(12, 0, 0, 0);
  return parsed.toISOString().slice(0, 10);
}

function formatDateLabel(dateString) {
  if (!dateString) return '近期';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatRelativeSyncTime(isoString) {
  const timestamp = new Date(isoString).getTime();
  if (!timestamp) return '刚刚';

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  return `${Math.round(diffHours / 24)} 天前`;
}

function parseDurationMinutes(durationText, fallbackMinutes = 0) {
  if (!durationText) return fallbackMinutes;
  const hourMatch = durationText.match(/(\d+)\s*小时/);
  const minuteMatch = durationText.match(/(\d+)\s*分/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  return hours * 60 + minutes || fallbackMinutes;
}

function computeDiscountText(price, originalPrice) {
  const safeOriginal = originalPrice > price ? originalPrice : Math.round(price * 1.25);
  return `${(price / safeOriginal * 10).toFixed(1)}折`;
}

function buildFallbackImage(seed, size = '800/600') {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}`;
}

function buildBookingUrl(source, route, departDate) {
  const { from, to } = route;
  if (source === '飞猪') {
    return `https://www.fliggy.com/redirect?type=5&searchQuery=${encodeURIComponent(`${from.city}-${to.city}`)}&departDate=${departDate}`;
  }
  if (source === '去哪儿') {
    return `https://flight.qunar.com/site/oneway_list.htm?searchDepartureAirport=${encodeURIComponent(from.city)}&searchArrivalAirport=${encodeURIComponent(to.city)}&searchDepartureTime=${departDate}`;
  }
  return `https://flights.ctrip.com/online/list/oneway-${from.code}-${to.code}?depdate=${departDate}`;
}

function buildAirportLabel(city, code, isInternational = false) {
  if (!city && !code) return '机场';
  if (!city) return code;
  return `${city}${isInternational ? '国际机场' : '机场'}`;
}

function normalizeLocationInput(rawValue, fallbackCode) {
  const value = String(rawValue || '').trim();
  const fallback = fallbackCode.toUpperCase();
  if (!value) {
    return { code: fallback, city: CITY_MAP[fallback] || fallback };
  }

  const upperValue = value.toUpperCase();
  if (CITY_MAP[upperValue]) {
    return { code: upperValue, city: CITY_MAP[upperValue] };
  }

  if (CITY_TO_CODE[value]) {
    return { code: CITY_TO_CODE[value], city: value };
  }

  const partialCity = Object.keys(CITY_TO_CODE).find(city => value.includes(city) || city.includes(value));
  if (partialCity) {
    return { code: CITY_TO_CODE[partialCity], city: partialCity };
  }

  const probableCode = (upperValue.match(/[A-Z]{3}/) || [fallback])[0];
  return { code: probableCode, city: value };
}

function normalizePriceHistory(history, basePrice, days = 15) {
  const input = safeArray(history).filter(entry => entry && Number(entry.price) > 0);
  if (input.length) {
    return input.map((entry, index) => ({
      date: entry.date || formatDateLabel(shiftDate(getRecommendedDate(), index - input.length + 1)),
      price: Number(entry.price)
    }));
  }

  const generated = [];
  const seed = Math.max(600, Math.round(basePrice || 1200));
  for (let index = days - 1; index >= 0; index -= 1) {
    const wobble = 0.8 + (((index * 17) % 11) / 100);
    generated.push({
      date: shiftDate(getRecommendedDate(), -(days - 1 - index)).slice(5),
      price: Math.round(seed * wobble)
    });
  }
  return generated;
}

function buildTrendBars(history) {
  const normalizedHistory = normalizePriceHistory(history, history?.[0]?.price || 1200);
  const prices = normalizedHistory.map(item => item.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const spread = Math.max(1, highestPrice - lowestPrice);

  return {
    lowestPrice,
    bars: normalizedHistory.map((item, index) => ({
      date: item.date,
      price: item.price,
      height: 28 + Math.round(((item.price - lowestPrice) / spread) * 56),
      isToday: index === normalizedHistory.length - 1,
      isLowest: item.price === lowestPrice
    }))
  };
}

function hasFreeBaggage(flight) {
  const tags = safeArray(flight.tags);
  const services = safeArray(flight.services);
  return tags.some(tag => tag.includes('含托运') || tag.includes('含行李')) ||
    services.some(service => String(service.label || '').includes('托运'));
}

function isCarryOnOnly(flight) {
  const tags = safeArray(flight.tags);
  const services = safeArray(flight.services);
  return tags.some(tag => tag.includes('仅手提') || tag.includes('不含托运')) ||
    services.some(service => String(service.label || '').includes('手提'));
}

function getTagClass(tag) {
  const text = String(tag || '');
  if (text.includes('直飞')) return 'direct';
  if (text.includes('可退') || text.includes('可改') || text.includes('含托运') || text.includes('含行李')) return 'good';
  if (text.includes('不可退') || text.includes('不可改') || text.includes('不含') || text.includes('仅手提')) return 'warn';
  if (text.includes('税费')) return 'tax';
  return 'refund';
}

function computeDealScore(deal) {
  const discountRatio = 1 - deal.price / Math.max(deal.originalPrice, deal.price + 1);
  const directBonus = deal.tags.some(tag => tag.includes('直飞')) ? 14 : 0;
  const baggageBonus = deal.tags.some(tag => tag.includes('托运') || tag.includes('行李')) ? 8 : 0;
  const flexibleBonus = deal.tags.some(tag => tag.includes('可退') || tag.includes('可改')) ? 10 : 0;
  return discountRatio * 100 + directBonus + baggageBonus + flexibleBonus - deal.price / 300;
}

function computeFlightScore(flight) {
  const discountRatio = 1 - flight.price / Math.max(flight.originalPrice, flight.price + 1);
  const directBonus = flight.direct ? 16 : Math.max(0, 8 - flight.stopCount * 4);
  const baggageBonus = hasFreeBaggage(flight) ? 8 : 0;
  const flexibleBonus = safeArray(flight.tags).some(tag => tag.includes('可退') || tag.includes('可改')) ? 10 : 0;
  const onTimeBonus = Number(flight.onTimeRate || 0) / 8;
  return discountRatio * 100 + directBonus + baggageBonus + flexibleBonus + onTimeBonus;
}

function inferDealReason(deal) {
  if (deal.recommendationReason) return deal.recommendationReason;
  if (deal.tags.some(tag => tag.includes('直飞'))) return '直飞更省时间，适合作为快速决策候选';
  if (deal.tags.some(tag => tag.includes('可退') || tag.includes('可改'))) return '限制更少，适合还在观望的出行计划';
  return '当前价格已进入值得关注的低位区间';
}

function inferFlightReason(flight) {
  if (flight.recommendationReason) return flight.recommendationReason;
  if (flight.direct && hasFreeBaggage(flight)) return '直飞且包含托运，适合对省心程度要求更高的用户';
  if (flight.direct) return '直飞节省中转时间，适合看重总耗时的用户';
  return '适合作为价格锚点，帮助你判断是否继续等低价';
}

function normalizeService(service) {
  if (!service) return null;
  return {
    icon: service.icon || 'check_circle',
    label: service.label || '平台信息',
    available: service.available !== false
  };
}

function normalizeDeal(rawDeal, index = 0) {
  const fromCode = rawDeal?.from?.code || DEFAULT_SEARCH.from;
  const toCode = rawDeal?.to?.code || DEFAULT_SEARCH.to;
  const fromCity = rawDeal?.from?.city || CITY_MAP[fromCode] || fromCode;
  const toCity = rawDeal?.to?.city || CITY_MAP[toCode] || toCode;
  const route = {
    from: { code: fromCode, city: fromCity },
    to: { code: toCode, city: toCity }
  };
  const price = Math.max(0, Number(rawDeal?.price) || 0);
  const originalPrice = Math.max(price + 100, Number(rawDeal?.originalPrice) || Math.round(price * 1.28));
  const departDate = rawDeal?.departDate || shiftDate(getRecommendedDate(), index);
  const normalized = {
    id: rawDeal?.id || `deal_${fromCode}_${toCode}_${index + 1}`,
    from: route.from,
    to: route.to,
    airline: rawDeal?.airline || '平台整合推荐',
    departDate,
    price,
    originalPrice,
    discount: rawDeal?.discount || computeDiscountText(price, originalPrice),
    source: rawDeal?.source || '携程',
    tags: uniqueStrings(rawDeal?.tags || []),
    recommendation: rawDeal?.recommendation || '值得关注',
    recommendationReason: rawDeal?.recommendationReason || rawDeal?.recReason || '',
    imageUrl: rawDeal?.imageUrl || rawDeal?.img || buildFallbackImage(`${fromCode}-${toCode}`),
    bookingUrl: rawDeal?.bookingUrl || rawDeal?.url || buildBookingUrl(rawDeal?.source || '携程', route, departDate),
    region: rawDeal?.region || 'domestic',
    hotTag: rawDeal?.hotTag || '',
    priceStatus: rawDeal?.priceStatus || '',
    priceStatusPercent: clamp(Number(rawDeal?.priceStatusPercent) || 24, 12, 48),
    priceHistory: normalizePriceHistory(rawDeal?.priceHistory, originalPrice),
    updatedAt: rawDeal?.updatedAt || new Date().toISOString()
  };

  normalized.recommendationReason = inferDealReason(normalized);
  if (!normalized.priceStatus) {
    const prices = normalized.priceHistory.map(entry => entry.price);
    const average = prices.reduce((sum, current) => sum + current, 0) / prices.length;
    const delta = Math.max(1, Math.round((average - normalized.price) / average * 100));
    normalized.priceStatus = `当前价格较近两周均价低 ${delta}%`;
    normalized.priceStatusPercent = clamp(delta, 16, 42);
  }
  return normalized;
}

function normalizeFlight(rawFlight, route, requestedDate, index = 0) {
  const price = Math.max(0, Number(rawFlight?.price) || 0);
  const originalPrice = Math.max(price + 100, Number(rawFlight?.originalPrice) || Math.round(price * 1.22));
  const departDate = rawFlight?.departDate || requestedDate || shiftDate(getRecommendedDate(), index);
  const tags = uniqueStrings(rawFlight?.tags || []);
  const direct = rawFlight?.direct !== undefined ? rawFlight.direct : !tags.some(tag => tag.includes('中转'));
  const stopCount = Number.isFinite(rawFlight?.stopCount) ? rawFlight.stopCount : (direct ? 0 : 1);
  const services = safeArray(rawFlight?.services).map(normalizeService).filter(Boolean);
  const departureCode = rawFlight?.departure?.code || route.from.code;
  const arrivalCode = rawFlight?.arrival?.code || route.to.code;
  const departureCity = CITY_MAP[departureCode] || route.from.city;
  const arrivalCity = CITY_MAP[arrivalCode] || route.to.city;
  const normalized = {
    id: rawFlight?.id || `flight_${route.from.code}_${route.to.code}_${index + 1}`,
    departDate,
    airline: rawFlight?.airline || '平台推荐航司',
    flightNo: rawFlight?.flightNo || `HJ${index + 1}${route.from.code}`,
    aircraft: rawFlight?.aircraft || '空客 A320',
    departure: {
      code: departureCode,
      airport: rawFlight?.departure?.airport || buildAirportLabel(departureCity, departureCode),
      time: rawFlight?.departure?.time || `${String(8 + index * 3).padStart(2, '0')}:20`
    },
    arrival: {
      code: arrivalCode,
      airport: rawFlight?.arrival?.airport || buildAirportLabel(arrivalCity, arrivalCode),
      time: rawFlight?.arrival?.time || `${String(10 + index * 3).padStart(2, '0')}:50`
    },
    durationMin: Number(rawFlight?.durationMin) || parseDurationMinutes(rawFlight?.durationText, 120 + index * 20),
    durationText: rawFlight?.durationText || `${2 + index} 小时 ${15 + index * 5} 分`,
    direct,
    stopCount,
    onTimeRate: Number(rawFlight?.onTimeRate) || 88,
    price,
    originalPrice,
    tags,
    services,
    recommendation: rawFlight?.recommendation || rawFlight?.badge || '推荐优先',
    recommendationReason: rawFlight?.recommendationReason || rawFlight?.recReason || '',
    badge: rawFlight?.badge || '',
    badgeType: rawFlight?.badgeType || '',
    bookingUrl: rawFlight?.bookingUrl || buildBookingUrl(rawFlight?.source || '携程', route, departDate),
    source: rawFlight?.source || '携程',
    updatedAt: rawFlight?.updatedAt || new Date().toISOString(),
    priceHistory: normalizePriceHistory(rawFlight?.priceHistory, originalPrice)
  };

  normalized.recommendationReason = inferFlightReason(normalized);
  return normalized;
}

function pickEffectiveDate(flights, requestedDate) {
  const exactHit = flights.find(flight => flight.departDate === requestedDate);
  if (exactHit) return requestedDate;

  let closestDate = flights[0]?.departDate || requestedDate;
  let closestDistance = Number.POSITIVE_INFINITY;
  safeArray(flights).forEach(flight => {
    const diff = Math.abs(new Date(`${flight.departDate}T12:00:00`).getTime() - new Date(`${requestedDate}T12:00:00`).getTime());
    if (diff < closestDistance) {
      closestDistance = diff;
      closestDate = flight.departDate;
    }
  });
  return closestDate;
}

function buildTrendConclusion(flights) {
  const cheapestFlight = safeArray(flights).slice().sort((a, b) => a.price - b.price)[0];
  if (!cheapestFlight) return '当前暂无稳定价格走势，建议稍后刷新查看';

  const history = cheapestFlight.priceHistory;
  const average = history.reduce((sum, item) => sum + item.price, 0) / history.length;
  const gap = Math.round((average - cheapestFlight.price) / average * 100);

  if (gap >= 12) return `比近两周均价低 ${gap}% ，适合优先打开规则与退改说明`;
  if (gap >= 5) return '价格已经回到可接受区间，建议结合行李与退改限制再做决定';
  return '价格接近均线，更适合作为观察标的而非立刻出手';
}

function normalizeMonitor(rawMonitor, index = 0) {
  const fromCode = rawMonitor?.from?.code || DEFAULT_SEARCH.from;
  const toCode = rawMonitor?.to?.code || DEFAULT_SEARCH.to;
  const fromCity = rawMonitor?.from?.city || CITY_MAP[fromCode] || fromCode;
  const toCity = rawMonitor?.to?.city || CITY_MAP[toCode] || toCode;
  const currentPrice = Math.max(0, Number(rawMonitor?.currentPrice) || 1800);
  const targetPrice = Math.max(0, Number(rawMonitor?.targetPrice) || Math.round(currentPrice * 0.9));
  return {
    id: rawMonitor?.id || `monitor_${index + 1}`,
    from: { code: fromCode, city: fromCity },
    to: { code: toCode, city: toCity },
    airline: rawMonitor?.airline || `${fromCity} → ${toCity}`,
    currentPrice,
    targetPrice,
    status: rawMonitor?.status || (currentPrice <= targetPrice ? 'below_target' : 'monitoring'),
    badge: rawMonitor?.badge || '',
    trend: safeArray(rawMonitor?.trend).length ? rawMonitor.trend : [40, 48, 55, 52, 46, 43, 38],
    lastUpdated: rawMonitor?.lastUpdated || '刚刚',
    highlight: Boolean(rawMonitor?.highlight),
    bookingUrl: rawMonitor?.bookingUrl || buildBookingUrl(rawMonitor?.source || '携程', { from: { code: fromCode, city: fromCity }, to: { code: toCode, city: toCity } }, getRecommendedDate())
  };
}

async function fetchData(endpoint) {
  if (API_CONFIG.USE_MOCK) return null;
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/${endpoint}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } catch (error) {
    console.warn('[API] 请求失败，使用兜底数据:', endpoint, error);
    return null;
  }
}

async function getDeals() {
  if (APP_STATE.dealsData) return APP_STATE.dealsData;

  const rawPayload = (await fetchData('deals.json')) || MOCK.deals;
  const deals = safeArray(rawPayload?.deals || rawPayload?.items).map((deal, index) => normalizeDeal(deal, index));
  deals.sort((left, right) => computeDealScore(right) - computeDealScore(left));

  APP_STATE.dealsData = {
    updatedAt: rawPayload?.updatedAt || new Date().toISOString(),
    count: deals.length,
    deals
  };
  return APP_STATE.dealsData;
}

function normalizeSearchPayload(rawPayload, request) {
  const route = {
    from: { code: request.from.code, city: request.from.city },
    to: { code: request.to.code, city: request.to.city }
  };
  const flights = safeArray(rawPayload?.flights).map((flight, index) => normalizeFlight(flight, route, request.requestedDate, index));
  if (!flights.length) return buildFallbackSearch(request);

  const effectiveDate = pickEffectiveDate(flights, request.requestedDate);
  const filteredFlights = flights.filter(flight => flight.departDate === effectiveDate);
  const trendSource = rawPayload?.trend?.bars?.length
    ? {
        lowestPrice: rawPayload.trend.lowestPrice || Math.min(...safeArray(rawPayload.trend.bars).map(item => Number(item.price) || 0).filter(Boolean)),
        bars: safeArray(rawPayload.trend.bars).map((item, index) => ({
          date: item.date || item.day || `D${index + 1}`,
          price: Number(item.price) || filteredFlights[0].price,
          height: Number(item.height) || 40,
          isToday: Boolean(item.isToday),
          isLowest: Boolean(item.isLowest)
        })),
        hint: rawPayload.trend.hint || '近 15 天价格走势'
      }
    : (() => {
        const generated = buildTrendBars(filteredFlights[0].priceHistory);
        return { ...generated, hint: '近 15 天价格走势' };
      })();
  const mode = effectiveDate === request.requestedDate ? 'exact' : 'nearby';

  return {
    updatedAt: rawPayload?.updatedAt || filteredFlights[0].updatedAt || new Date().toISOString(),
    route,
    requestedDate: request.requestedDate,
    effectiveDate,
    mode,
    searchNotice: rawPayload?.notice || (mode === 'nearby'
      ? `所选日期暂无稳定样例数据，已为你展示 ${formatDateLabel(effectiveDate)} 前后 3 天更值得关注的低价`
      : `已为你展示 ${formatDateLabel(effectiveDate)} 的推荐结果，并按性价比整理`),
    trendConclusion: rawPayload?.trendConclusion || buildTrendConclusion(filteredFlights),
    trend: {
      lowestPrice: trendSource.lowestPrice || Math.min(...filteredFlights.map(flight => flight.price)),
      bars: trendSource.bars,
      hint: trendSource.hint
    },
    flights: filteredFlights
  };
}

function buildFallbackSearch(request) {
  const route = {
    from: { code: request.from.code, city: request.from.city },
    to: { code: request.to.code, city: request.to.city }
  };
  const routeSeed = `${route.from.code}${route.to.code}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const nearbyOffset = (routeSeed % 3) - 1 || 1;
  const effectiveDate = shiftDate(request.requestedDate, nearbyOffset);
  const templateFlights = safeArray(MOCK.search.flights).map((flight, index) => {
    const cloned = JSON.parse(JSON.stringify(flight));
    const basePrice = Math.max(680, cloned.price + ((routeSeed * (index + 3)) % 900) - 250);
    cloned.price = basePrice;
    cloned.originalPrice = basePrice + 480 + (routeSeed % 600);
    cloned.departDate = effectiveDate;
    cloned.departure = cloned.departure || {};
    cloned.arrival = cloned.arrival || {};
    cloned.departure.code = route.from.code;
    cloned.arrival.code = route.to.code;
    cloned.departure.airport = buildAirportLabel(route.from.city, route.from.code);
    cloned.arrival.airport = buildAirportLabel(route.to.city, route.to.code);
    cloned.source = index % 2 === 0 ? '携程' : '去哪儿';
    cloned.bookingUrl = buildBookingUrl(cloned.source, route, effectiveDate);
    cloned.recommendationReason = cloned.recommendationReason || `当前路线暂无精确样例，已按 ${formatDateLabel(effectiveDate)} 附近低价模拟推荐`;
    cloned.badge = index === 0 ? '推荐优先' : cloned.badge;
    cloned.badgeType = index === 0 ? 'cheapest' : cloned.badgeType;
    return normalizeFlight(cloned, route, effectiveDate, index);
  });

  const trend = buildTrendBars(templateFlights[0].priceHistory);
  return {
    updatedAt: new Date().toISOString(),
    route,
    requestedDate: request.requestedDate,
    effectiveDate,
    mode: 'nearby',
    searchNotice: `所选日期暂无稳定样例数据，已为你展示 ${formatDateLabel(effectiveDate)} 前后 3 天更值得关注的低价`,
    trendConclusion: buildTrendConclusion(templateFlights),
    trend: { ...trend, hint: '近 15 天价格走势' },
    flights: templateFlights
  };
}

async function getSearch(fromCode, toCode, requestedDate) {
  const request = {
    from: { code: fromCode, city: CITY_MAP[fromCode] || fromCode },
    to: { code: toCode, city: CITY_MAP[toCode] || toCode },
    requestedDate
  };

  const endpoints = [
    `search/${fromCode}-${toCode}-${requestedDate}.json`,
    `search/${fromCode}-${toCode}.json`
  ];

  for (const endpoint of endpoints) {
    const payload = await fetchData(endpoint);
    if (payload) return normalizeSearchPayload(payload, request);
  }

  return buildFallbackSearch(request);
}

async function getMonitors() {
  const rawPayload = (await fetchData('monitors.json')) || MOCK.monitors;
  APP_STATE.monitorStats = rawPayload?.stats || MOCK.monitors.stats;

  if (safeArray(APP_STATE.monitors).length) {
    APP_STATE.monitors = APP_STATE.monitors.map((monitor, index) => normalizeMonitor(monitor, index));
  } else {
    APP_STATE.monitors = safeArray(rawPayload?.monitors).map((monitor, index) => normalizeMonitor(monitor, index));
    saveAppState();
  }

  return {
    updatedAt: rawPayload?.updatedAt || new Date().toISOString(),
    monitors: APP_STATE.monitors,
    stats: APP_STATE.monitorStats
  };
}

function buildPriceTrendMini(history) {
  const { bars } = buildTrendBars(history);
  return bars.map(bar => ({
    height: clamp(bar.height, 24, 88),
    isLowest: bar.isLowest,
    isToday: bar.isToday
  }));
}

function buildBaggageRuleText(flight) {
  if (hasFreeBaggage(flight)) {
    const baggageService = safeArray(flight.services).find(service => String(service.label || '').includes('托运'));
    return baggageService ? `包含 ${baggageService.label}` : '包含免费托运行李';
  }
  if (isCarryOnOnly(flight)) return '仅含手提行李，出发前请确认平台规则';
  return '行李规则以平台实时页说明为准';
}

function buildRefundRuleText(flight) {
  if (safeArray(flight.tags).some(tag => tag.includes('可退') || tag.includes('可改'))) {
    return '该票规更灵活，适合行程仍可能变动的用户';
  }
  if (safeArray(flight.tags).some(tag => tag.includes('不可退') || tag.includes('不可改'))) {
    return '折扣票限制较多，锁票前请先确认出行计划';
  }
  return '退改规则以下游平台实时说明为准';
}

function buildServiceRuleText(flight) {
  const availableServices = safeArray(flight.services).filter(service => service.available !== false);
  if (availableServices.length) {
    return `已展示 ${availableServices.map(service => service.label).slice(0, 3).join('、')} 等决策信息`;
  }
  return '重点展示准点率、机型和基础服务信息';
}

function buildSimilarRoutes(route) {
  const pool = safeArray(APP_STATE.dealsData?.deals).length
    ? APP_STATE.dealsData.deals
    : safeArray(MOCK.deals.deals).map((deal, index) => normalizeDeal(deal, index));

  return pool
    .filter(deal => !(deal.from.code === route.from.code && deal.to.code === route.to.code))
    .slice(0, 3)
    .map(deal => ({
      from: deal.from.code,
      to: deal.to.code,
      toCity: deal.to.city,
      date: formatDateLabel(deal.departDate),
      info: `${deal.airline} · ${deal.recommendationReason}`,
      price: deal.price,
      imageUrl: deal.imageUrl,
      bookingUrl: deal.bookingUrl
    }));
}

function buildDetailPayload(flight, detailOverride = null) {
  const route = APP_STATE.currentSearchData?.route || {
    from: { code: flight.departure.code, city: CITY_MAP[flight.departure.code] || flight.departure.code },
    to: { code: flight.arrival.code, city: CITY_MAP[flight.arrival.code] || flight.arrival.code }
  };
  const history = normalizePriceHistory(detailOverride?.flight?.priceHistory || flight.priceHistory, flight.originalPrice);
  const trendMini = detailOverride?.flight?.priceTrend || buildPriceTrendMini(history);
  const lowestPrice = detailOverride?.flight?.historicalLowest || Math.min(...history.map(item => item.price));
  const currentPrice = flight.price;
  const baseAmount = detailOverride?.flight?.priceBreakdown?.base || Math.round(currentPrice * 0.86);
  const taxAmount = detailOverride?.flight?.priceBreakdown?.tax || currentPrice - baseAmount;
  const detail = {
    id: flight.id,
    airline: flight.airline,
    flightNo: flight.flightNo,
    aircraft: flight.aircraft,
    departure: {
      time: detailOverride?.flight?.departure?.time || flight.departure.time,
      code: detailOverride?.flight?.departure?.code || flight.departure.code,
      airport: detailOverride?.flight?.departure?.airport || buildAirportLabel(route.from.city, route.from.code, true),
      terminal: detailOverride?.flight?.departure?.terminal || 'T2'
    },
    arrival: {
      time: detailOverride?.flight?.arrival?.time || flight.arrival.time,
      code: detailOverride?.flight?.arrival?.code || flight.arrival.code,
      airport: detailOverride?.flight?.arrival?.airport || buildAirportLabel(route.to.city, route.to.code, true),
      terminal: detailOverride?.flight?.arrival?.terminal || 'T1'
    },
    durationText: detailOverride?.flight?.durationText || flight.durationText,
    direct: detailOverride?.flight?.direct ?? flight.direct,
    price: currentPrice,
    originalPrice: flight.originalPrice,
    cabin: detailOverride?.flight?.cabin || '经济舱',
    seatsLeft: detailOverride?.flight?.seatsLeft || 4,
    priceBreakdown: {
      base: baseAmount,
      tax: taxAmount,
      total: detailOverride?.flight?.priceBreakdown?.total || currentPrice
    },
    rules: detailOverride?.flight?.rules || {
      baggage: { title: '行李额度', detail: buildBaggageRuleText(flight), icon: 'luggage' },
      refund: { title: '退改规则', detail: buildRefundRuleText(flight), icon: 'swap_horiz' },
      service: { title: '机上体验', detail: buildServiceRuleText(flight), icon: 'airline_seat_recline_extra' }
    },
    priceTrend: trendMini,
    historicalLowest: lowestPrice,
    similarRoutes: detailOverride?.flight?.similarRoutes || buildSimilarRoutes(route),
    bookingUrl: detailOverride?.flight?.bookingUrl || flight.bookingUrl,
    source: detailOverride?.flight?.source || flight.source,
    bestPriceBadge: detailOverride?.flight?.bestPriceBadge || flight.badge || flight.recommendation,
    updatedAt: detailOverride?.flight?.updatedAt || flight.updatedAt
  };

  return { updatedAt: detail.updatedAt, flight: detail };
}

async function getFlightDetail(id) {
  const payload = await fetchData(`flights/${id}.json`);
  const selectedFlight = safeArray(APP_STATE.currentResults).find(flight => flight.id === id) ||
    safeArray(APP_STATE.currentSearchData?.flights).find(flight => flight.id === id);

  if (payload?.flight && selectedFlight) return buildDetailPayload(selectedFlight, payload);
  if (selectedFlight) return buildDetailPayload(selectedFlight);

  const fallbackFlight = normalizeFlight(MOCK.search.flights[0], {
    from: { code: DEFAULT_SEARCH.from, city: CITY_MAP[DEFAULT_SEARCH.from] },
    to: { code: DEFAULT_SEARCH.to, city: CITY_MAP[DEFAULT_SEARCH.to] }
  }, getRecommendedDate());
  return buildDetailPayload(fallbackFlight, payload || MOCK.detail);
}

function updateResultsHeader(data) {
  const titleEl = document.getElementById('results-title');
  const countEl = document.getElementById('results-count');
  if (titleEl) {
    titleEl.textContent = `${data.route.from.city} (${data.route.from.code}) → ${data.route.to.city} (${data.route.to.code})`;
  }
  if (countEl) {
    const summary = [];
    summary.push(`共 ${data.flights.length} 个结果`);
    summary.push(data.mode === 'nearby' ? `已展示 ${formatDateLabel(data.effectiveDate)} 前后 3 天低价` : '已按推荐优先排序');
    summary.push(`最近同步 ${formatRelativeSyncTime(data.updatedAt)}`);
    countEl.textContent = summary.join(' · ');
  }
}

function renderDeals(data) {
  const container = document.getElementById('deals-container');
  if (!container) return;

  const deals = safeArray(data?.deals).map((deal, index) => normalizeDeal(deal, index));
  if (!deals.length) {
    container.innerHTML = `<div style="grid-column:1/-1;background:var(--surface-lowest);border-radius:var(--radius-lg);padding:2rem;box-shadow:var(--shadow-soft);color:var(--outline);">当前暂无稳定特价数据，请稍后刷新查看。</div>`;
    return;
  }

  container.innerHTML = deals.map(deal => `
    <div class="deal-card" onclick="openBooking('${deal.bookingUrl}')">
      <div class="deal-card-img">
        <img src="${deal.imageUrl}" alt="${deal.to.city}" onerror="this.onerror=null; this.src='${buildFallbackImage(deal.to.city)}';">
        <span class="discount-badge">${deal.discount}</span>
        <span class="source-badge">来自${deal.source}</span>
      </div>
      <div class="deal-card-body">
        <div class="deal-route">
          <div>
            <h3>${deal.from.city} → ${deal.to.city}</h3>
            <div class="deal-date">${deal.departDate} · ${deal.airline}</div>
          </div>
          <div class="deal-price">
            <div class="current">¥${deal.price.toLocaleString()}</div>
            <div class="original">参考均价 ¥${deal.originalPrice.toLocaleString()}</div>
          </div>
        </div>
        <div class="deal-tags">
          ${deal.tags.map(tag => `<span class="deal-tag ${getTagClass(tag)}">${tag}</span>`).join('')}
          ${deal.hotTag ? `<span class="deal-tag hot">${deal.hotTag}</span>` : ''}
        </div>
        <div class="deal-recommendation"><span class="rec-tag">${deal.recommendation}</span>${deal.recommendationReason}</div>
        ${deal.priceStatus ? `<div class="deal-status"><div class="deal-status-fill" style="width:${deal.priceStatusPercent || 24}%"></div><span>${deal.priceStatus}</span></div>` : ''}
        <div class="deal-meta"><span>最近同步 ${formatRelativeSyncTime(deal.updatedAt)}</span><span>去${deal.source}查看 ↗</span></div>
      </div>
    </div>
  `).join('');

  const timeEl = document.getElementById('deals-update-time');
  if (timeEl) {
    timeEl.innerHTML = `数据最近同步 ${formatRelativeSyncTime(data.updatedAt)}<span class="source-disclaimer" style="margin-left:1rem;">先看推荐理由和票规，再决定是否跳转平台</span>`;
  }
}

function renderTrend(trend, conclusion) {
  const bars = safeArray(trend?.bars);
  const hint = trend?.hint || '近 15 天价格走势';
  const lowestPrice = trend?.lowestPrice || (bars.length ? Math.min(...bars.map(item => item.price)) : 0);

  return `
    ${conclusion ? `<div class="trend-conclusion"><span class="material-symbols-outlined">trending_down</span>${conclusion}</div>` : ''}
    <div class="trend-header">
      <div>
        <h3>价格走势</h3>
        <div class="trend-hint">${hint}</div>
      </div>
      <div class="price">
        <div class="price-label">历史低位</div>
        <div class="price-value">¥${lowestPrice.toLocaleString()}</div>
      </div>
    </div>
    <div class="trend-chart">
      ${bars.length ? bars.map(bar => `
        <div class="trend-bar-wrap ${bar.isToday ? 'today' : ''}">
          <div class="trend-bar ${bar.isLowest ? 'lowest' : ''}" style="height:${bar.height}%">
            <div class="trend-tooltip">¥${bar.price.toLocaleString()}<br/>${bar.date}</div>
          </div>
        </div>
      `).join('') : '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--outline);font-size:0.8rem;">正在同步最新历史价格...</div>'}
    </div>`;
}

function renderFlights(data) {
  updateResultsHeader(data);

  const trendBox = document.getElementById('trend-container');
  if (trendBox) trendBox.innerHTML = renderTrend(data.trend, data.searchNotice || data.trendConclusion);

  const container = document.getElementById('flights-container');
  if (!container) return;

  if (!safeArray(data.flights).length) {
    container.innerHTML = `<div style="text-align:center;padding:4rem;grid-column:1/-1;color:var(--outline);">
      <span class="material-symbols-outlined" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;">search_off</span>
      <p>当前筛选条件下暂无结果，建议放宽价格区间或查看临近日期低价。</p>
    </div>`;
    return;
  }

  container.innerHTML = data.flights.map(flight => {
    const badgeClass = flight.badgeType === 'cheapest'
      ? 'cheapest'
      : (flight.badgeType === 'safest' ? 'safest' : (flight.badgeType === 'business' ? 'business' : ''));
    return `
      <div class="flight-card" onclick="showFlightDetail('${flight.id}')">
        ${flight.badge ? `<div class="flight-card-badge ${badgeClass}">${flight.badge}</div>` : ''}
        <div class="fc-airline">
          <div class="fc-airline-logo">
            <img src="https://img.logo.dev/${encodeURIComponent(flight.airline)}?token=placeholder&size=100"
                 alt="${flight.airline}" class="fc-airline-img"
                 onerror="this.onerror=null; this.src='${buildFallbackImage(`${flight.airline}-logo`, '100/100')}';">
          </div>
          <div>
            <div class="fc-airline-name">${flight.airline}</div>
            <div class="fc-airline-detail">${flight.flightNo} | ${flight.aircraft}</div>
            <div class="fc-rec-reason"><span class="material-symbols-outlined">tips_and_updates</span>${flight.recommendationReason}</div>
            ${flight.tags.length ? `<div class="fc-tags">${flight.tags.map(tag => `<span class="fc-tag ${getTagClass(tag)}">${tag}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        <div class="fc-times">
          <div class="fc-time">
            <div class="fc-time-value">${flight.departure.time}</div>
            <div class="fc-time-airport">${flight.departure.airport}</div>
          </div>
          <div class="fc-duration">
            <div class="fc-duration-text">${flight.durationText}</div>
            <div class="fc-duration-line"><span class="material-symbols-outlined detail-flight-icon" style="font-size:1rem;top:-8px;">flight</span></div>
            <div class="fc-duration-rate ${flight.onTimeRate >= 90 ? 'good' : (flight.onTimeRate >= 80 ? 'mid' : 'bad')}">准点率 ${flight.onTimeRate}%</div>
          </div>
          <div class="fc-time">
            <div class="fc-time-value">${flight.arrival.time}</div>
            <div class="fc-time-airport">${flight.arrival.airport}</div>
          </div>
        </div>
        <div class="fc-right">
          <div class="fc-services">
            ${flight.services.map(service => `
              <div class="fc-service ${service.available ? '' : 'unavailable'}">
                <span class="material-symbols-outlined">${service.icon}</span>
                <span>${service.label}</span>
              </div>
            `).join('')}
          </div>
          <div class="fc-price-old">¥${flight.originalPrice.toLocaleString()}</div>
          <div class="fc-price">¥${flight.price.toLocaleString()}</div>
          <button class="fc-book" onclick="event.stopPropagation(); openBooking('${flight.bookingUrl}')">去${flight.source}查看 ↗</button>
          <div class="fc-updated">${formatDateLabel(flight.departDate)} 出发 · 最近同步 ${formatRelativeSyncTime(flight.updatedAt)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDetail(data) {
  const flight = data.flight;
  const rules = Object.keys(flight.rules || {});
  const container = document.getElementById('detail-container');
  if (!container) return;

  container.innerHTML = `
    <div class="detail-top">
      <div>
        <div class="detail-flight-card">
          <div class="detail-flight-header">
            <div class="detail-port">
              <div class="detail-port-code">出发 · ${flight.departure.code}</div>
              <div class="detail-port-time">${flight.departure.time}</div>
              <div class="detail-port-name">${flight.departure.airport} ${flight.departure.terminal}</div>
            </div>
            <div class="detail-flight-line">
              <div class="detail-flight-duration">${flight.durationText} · ${flight.direct ? '直飞' : '中转'}</div>
              <div class="detail-flight-track" style="width:100%;"><span class="material-symbols-outlined detail-flight-icon">flight</span></div>
              <div class="detail-flight-info"><strong>${flight.airline} ${flight.flightNo}</strong> · ${flight.aircraft}</div>
            </div>
            <div class="detail-port">
              <div class="detail-port-code">到达 · ${flight.arrival.code}</div>
              <div class="detail-port-time">${flight.arrival.time}</div>
              <div class="detail-port-name">${flight.arrival.airport} ${flight.arrival.terminal}</div>
            </div>
          </div>
        </div>
        <div class="rules-section">
          <div class="rules-title"><span class="material-symbols-outlined">verified_user</span>判断这张票值不值得买</div>
          <div class="rules-grid">
            ${rules.map(key => {
              const rule = flight.rules[key];
              return `
                <div class="rule-card">
                  <div class="rule-icon"><span class="material-symbols-outlined">${rule.icon}</span></div>
                  <h4>${rule.title}</h4>
                  <p>${String(rule.detail || '').replace(/\n/g, '<br/>')}</p>
                </div>
              `;
            }).join('')}
          </div>
          <div class="trust-tags">
            <span class="trust-tag"><span class="material-symbols-outlined">bolt</span> 优先展示可理解的低价</span>
            <span class="trust-tag"><span class="material-symbols-outlined">verified</span> 不伪装出票链路</span>
            <span class="trust-tag"><span class="material-symbols-outlined">visibility</span> 先解释，再跳平台</span>
          </div>
        </div>
      </div>
      <div class="detail-sidebar">
        <div class="price-card">
          <span class="price-card-badge">${flight.bestPriceBadge || '值得关注'}</span>
          <div class="original">参考均价 ¥${flight.originalPrice.toLocaleString()}</div>
          <div class="cabin">${flight.cabin}</div>
          <div class="amount">¥${flight.price.toLocaleString()}</div>
          <a class="btn-book" href="${flight.bookingUrl}" target="_blank" rel="noopener">去${flight.source || '携程'}查看 ↗</a>
          <div class="seats-left">仅剩 ${flight.seatsLeft} 张此价格 · 决策后再跳转平台，减少无效比价</div>
          <div class="price-breakdown">
            <div class="price-row"><span>票面价格</span><span>¥${flight.priceBreakdown.base.toLocaleString()}</span></div>
            <div class="price-row"><span>税费估算</span><span>¥${flight.priceBreakdown.tax.toLocaleString()}</span></div>
            <div class="price-row total"><span>参考总额</span><span>¥${flight.priceBreakdown.total.toLocaleString()}</span></div>
          </div>
          <div class="source-disclaimer" style="text-align:center;margin-top:0.75rem;">最近同步 ${formatRelativeSyncTime(flight.updatedAt)} · 来自${flight.source}</div>
        </div>
        <div class="alert-card" onclick="addMonitorFromDetail()">
          <div class="alert-icon"><span class="material-symbols-outlined icon-filled">notifications_active</span></div>
          <div class="alert-text"><h4>加入目标价监控</h4><p>如果你还不确定，先记下心理价位，等低价接近时再回来</p></div>
          <div class="alert-add"><span class="material-symbols-outlined" style="font-size:1rem;">add</span></div>
        </div>
      </div>
    </div>
    <div class="detail-bottom">
      <div class="detail-trend-card">
        <div class="trend-conclusion"><span class="material-symbols-outlined">trending_down</span>历史低位 ¥${flight.historicalLowest.toLocaleString()}，当前价格已进入值得关注区间</div>
        <div class="trend-header">
          <div><h3>价格趋势</h3><div style="font-size:0.8rem;color:var(--outline);margin-top:0.15rem;">只展示足以辅助判断的趋势信息</div></div>
          <div class="price"><div class="price-label">历史最低</div><div class="price-value">¥${flight.historicalLowest.toLocaleString()}</div></div>
        </div>
        <div class="trend-chart" style="height:100px;margin-top:1.5rem;">
          ${(flight.priceTrend || []).map(point => `
            <div class="trend-bar-wrap ${point.isToday ? 'today' : ''}">
              <div class="trend-bar ${point.isToday ? 'today' : (point.isLowest ? 'low' : '')}" style="height:${point.height}%"></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <h3 style="font-size:1.15rem;font-weight:800;margin-bottom:1.25rem;">你还可以顺手看看</h3>
        <div class="similar-list">
          ${(flight.similarRoutes || []).map(route => `
            <div class="similar-item" onclick="openBooking('${route.bookingUrl}')">
              <div class="similar-thumb"><img src="${route.imageUrl}" alt="${route.toCity}" onerror="this.onerror=null; this.src='${buildFallbackImage(route.toCity, '100/100')}';" /></div>
              <div class="similar-info"><h4>${route.from} → ${route.toCity} ${route.to}</h4><p>${route.date} · ${route.info}</p></div>
              <div class="similar-price"><div class="label">起价</div><div class="value">¥${route.price.toLocaleString()}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMonitors(data) {
  const container = document.getElementById('monitors-container');
  if (!container) return;

  const monitors = safeArray(data.monitors).map((monitor, index) => normalizeMonitor(monitor, index));
  if (!monitors.length) {
    container.innerHTML = `<div style="grid-column:1/-1;background:var(--surface-lowest);border-radius:var(--radius-lg);padding:2rem;box-shadow:var(--shadow-soft);color:var(--outline);">还没有目标价监控。先搜一条路线，再把心理价位保存下来。</div>`;
  } else {
    container.innerHTML = monitors.map(monitor => {
      const isHighlight = monitor.highlight || monitor.status === 'near_target';
      const priceColor = monitor.status === 'below_target'
        ? '#2e7d32'
        : (monitor.status === 'near_target' ? 'var(--tertiary-fixed-dim)' : 'var(--tertiary-accent)');
      const actionLabel = monitor.status === 'below_target' || monitor.status === 'near_target' ? '去平台查看 ↗' : '查看航线';
      const actionHandler = monitor.status === 'below_target' || monitor.status === 'near_target'
        ? `openBooking('${monitor.bookingUrl}')`
        : `focusMonitorRoute('${monitor.id}')`;

      return `
        <div class="monitor-card ${isHighlight ? 'highlight' : ''}" data-monitor-id="${monitor.id}">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="monitor-icon" style="margin-bottom:0;"><span class="material-symbols-outlined">flight_takeoff</span></div>
              ${monitor.badge ? `<span class="monitor-badge" style="position:static; margin:0; padding:0.25rem 0.65rem;">${monitor.badge}</span>` : ''}
            </div>
            <button onclick="event.stopPropagation(); removeMonitor(this)" title="取消监控" style="background:none;border:none;color:var(--outline-variant);cursor:pointer;padding:0.25rem;border-radius:4px;transition:all 0.2s;" onmouseover="this.style.color='#d32f2f';this.style.background='rgba(211,47,47,0.08)'" onmouseout="this.style.color='var(--outline-variant)';this.style.background='none'">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
          <div class="monitor-route">${monitor.from.city} (${monitor.from.code}) → ${monitor.to.city} (${monitor.to.code})</div>
          <div class="monitor-airline">${monitor.airline}</div>
          <div class="monitor-prices">
            <div><div class="monitor-label">目标价</div><div class="monitor-target">¥${monitor.targetPrice.toLocaleString()}</div></div>
            <div><div class="monitor-label">当前价</div><div class="monitor-current" style="color:${priceColor}">¥${monitor.currentPrice.toLocaleString()}</div></div>
          </div>
          ${monitor.trend.length ? `<div class="monitor-trend">${monitor.trend.map((height, index) => `<div class="monitor-trend-bar ${index === monitor.trend.length - 1 ? 'current' : ''}" style="height:${height}%"></div>`).join('')}</div>` : ''}
          ${isHighlight ? `<div style="background:rgba(255,255,255,0.08);border-radius:var(--radius-sm);padding:0.75rem;margin-bottom:1rem;font-size:0.75rem;line-height:1.5;">价格已经接近你的心理价位，现在适合回到详情页做最终判断。</div>` : ''}
          <div class="monitor-footer">
            <span>${monitor.lastUpdated ? `最后更新: ${monitor.lastUpdated}` : ''}</span>
            <span class="monitor-action" onclick="event.stopPropagation(); ${actionHandler}">${actionLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML += `<div class="monitor-add" onclick="addQuickMonitor()"><span class="material-symbols-outlined">add_circle_outline</span><h4>添加目标价监控</h4><p>把你心里能接受的价格存下来，系统只负责提醒，不替你冲动下单。</p></div>`;

  const dealsStat = document.getElementById('stat-deals');
  const partnersStat = document.getElementById('stat-partners');
  if (dealsStat) dealsStat.textContent = (data.stats?.todayDeals || 0).toLocaleString();
  if (partnersStat) partnersStat.textContent = `${data.stats?.partners || 0}+`;
}

function renderQuickStatus(deals, monitorData) {
  const notifList = document.getElementById('notif-list');
  const notifButton = document.getElementById('notif-btn');
  if (!notifList || !notifButton) return;

  const monitors = safeArray(monitorData.monitors);
  const belowTargetCount = monitors.filter(monitor => monitor.status === 'below_target').length;
  const activeBadge = belowTargetCount > 0 ? String(belowTargetCount) : '1';
  notifButton.setAttribute('data-badge', activeBadge);

  notifList.innerHTML = `
    <div class="notif-item" onclick="navigateTo('home'); switchTab('explore'); toggleNotif()">
      <div class="notif-item-title">📡 数据状态</div>
      <div class="notif-item-desc">当前展示 ${deals.deals.length} 条值得关注的特价线索，最近同步 ${formatRelativeSyncTime(deals.updatedAt)}。</div>
      <div class="notif-item-time">点击回到首页</div>
    </div>
    <div class="notif-item" onclick="navigateTo('home'); switchTab('monitor'); toggleNotif()">
      <div class="notif-item-title">🎯 监控进展</div>
      <div class="notif-item-desc">已保存 ${monitors.length} 条目标价，其中 ${belowTargetCount} 条已经低于你的目标价。</div>
      <div class="notif-item-time">点击查看监控</div>
    </div>
    <div class="notif-item" onclick="navigateTo('profile'); toggleNotif()">
      <div class="notif-item-title">🧭 使用建议</div>
      <div class="notif-item-desc">先看推荐理由，再核对退改和行李；如果指定日期无结果，系统会展示临近低价。</div>
      <div class="notif-item-time">查看使用说明</div>
    </div>
  `;
}

function renderProfileStats() {
  const monitorCount = document.getElementById('prof-monitors');
  const sortLogic = document.getElementById('prof-score');
  const lastSync = document.getElementById('prof-sync');
  const lastSyncDesc = document.getElementById('guide-last-sync-desc');

  if (monitorCount) monitorCount.textContent = `${safeArray(APP_STATE.monitors).length} 条`;
  if (sortLogic) sortLogic.textContent = '价格 / 退改 / 准点';
  if (lastSync) lastSync.textContent = APP_STATE.dealsData ? formatRelativeSyncTime(APP_STATE.dealsData.updatedAt) : '等待加载';
  if (lastSyncDesc) lastSyncDesc.textContent = APP_STATE.dealsData
    ? `特价数据最近同步 ${formatRelativeSyncTime(APP_STATE.dealsData.updatedAt)}`
    : '页面加载后会显示最近同步时间';
}

function toggleNotif() {
  const userDropdown = document.getElementById('user-dropdown');
  const notifDropdown = document.getElementById('notif-dropdown');
  if (userDropdown) userDropdown.classList.remove('show');
  if (notifDropdown) notifDropdown.classList.toggle('show');
}

function toggleUserMenu() {
  const notifDropdown = document.getElementById('notif-dropdown');
  const userDropdown = document.getElementById('user-dropdown');
  if (notifDropdown) notifDropdown.classList.remove('show');
  if (userDropdown) userDropdown.classList.toggle('show');
}

function clearNotifs() {
  const list = document.getElementById('notif-list');
  const button = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (list) list.innerHTML = '<div class="notif-empty">当前没有更多系统提示，返回首页继续看特价即可。</div>';
  if (button) button.classList.remove('notif-badge');
  setTimeout(() => {
    if (dropdown) dropdown.classList.remove('show');
  }, 600);
}

function openBooking(url) {
  if (!url || url === '#') {
    showToast('当前样例暂无可跳转平台，请先查看推荐理由和票规');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(node => node.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const navExplore = document.getElementById('nav-explore');
  const navMonitor = document.getElementById('nav-subscription');
  if (page === 'home') {
    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (navExplore) navExplore.classList.toggle('active', activeTab === 'tab-explore');
    if (navMonitor) navMonitor.classList.toggle('active', activeTab === 'tab-monitor');
  } else {
    if (navExplore) navExplore.classList.remove('active');
    if (navMonitor) navMonitor.classList.remove('active');
  }

  if (page === 'profile') renderProfileStats();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(node => node.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');

  const navExplore = document.getElementById('nav-explore');
  const navMonitor = document.getElementById('nav-subscription');
  if (navExplore) navExplore.classList.toggle('active', tab === 'explore');
  if (navMonitor) navMonitor.classList.toggle('active', tab === 'monitor');

  const chips = document.getElementById('home-chips');
  if (chips) chips.style.display = tab === 'explore' ? 'flex' : 'none';
}

function refreshResultsBackground(city) {
  const background = document.getElementById('results-hero-bg');
  if (!background) return;

  background.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  const imageId = ROUTE_BACKGROUNDS[city];
  if (!imageId) return;

  const image = new Image();
  const url = `https://images.unsplash.com/photo-${imageId}?w=1600&q=80`;
  image.src = url;
  image.onload = () => {
    background.style.backgroundImage = `url('${url}')`;
  };
}

function fillSearchForm(route, dateString) {
  const fromInput = document.getElementById('input-from');
  const toInput = document.getElementById('input-to');
  const dateInput = document.getElementById('input-date');
  if (fromInput) fromInput.value = route.from.city;
  if (toInput) toInput.value = route.to.city;
  if (dateInput) dateInput.value = dateString;
}

function readSearchForm() {
  const fromInput = document.getElementById('input-from');
  const toInput = document.getElementById('input-to');
  const dateInput = document.getElementById('input-date');

  const from = normalizeLocationInput(fromInput?.value, DEFAULT_SEARCH.from);
  const to = normalizeLocationInput(toInput?.value, DEFAULT_SEARCH.to);
  const normalizedDate = normalizeDateInput(dateInput?.value) || getRecommendedDate();

  if (dateInput && dateInput.value !== normalizedDate) {
    dateInput.value = normalizedDate;
  }

  return { from, to, date: normalizedDate };
}

function showRecommendedRoute() {
  fillSearchForm(
    {
      from: { code: DEFAULT_SEARCH.from, city: CITY_MAP[DEFAULT_SEARCH.from] },
      to: { code: DEFAULT_SEARCH.to, city: CITY_MAP[DEFAULT_SEARCH.to] }
    },
    getRecommendedDate()
  );
  doSearch();
}

async function filterDeals(trigger) {
  const chips = document.querySelectorAll('#home-chips .chip');
  chips.forEach(chip => chip.classList.remove('active'));
  if (trigger) trigger.classList.add('active');

  const data = await getDeals();
  let deals = [...safeArray(data.deals)];
  const chipText = (trigger?.innerText || '国内精选').trim();

  if (chipText === '国内精选') {
    deals = deals.filter(deal => deal.region === 'domestic');
  } else if (chipText === '国际大促') {
    deals = deals.filter(deal => deal.region === 'intl');
  } else if (chipText === '直飞特惠') {
    deals = deals.filter(deal => deal.tags.some(tag => tag.includes('直飞')));
  } else if (chipText === '本周末') {
    deals = deals.filter(deal => {
      const weekday = new Date(`${deal.departDate}T12:00:00`).getDay();
      return weekday === 6 || weekday === 0;
    });
  } else if (chipText === '说走就走') {
    deals = deals.filter(deal => deal.tags.some(tag => tag.includes('极速出票') || tag.includes('低价')));
  }

  deals.sort((left, right) => computeDealScore(right) - computeDealScore(left));
  renderDeals({ ...data, deals: deals.slice(0, 6) });
}

async function doSearch() {
  const request = readSearchForm();
  if (request.from.code === request.to.code) {
    showToast('出发地和目的地不能相同');
    return;
  }

  refreshResultsBackground(request.to.city);
  navigateTo('results');

  const searchData = await getSearch(request.from.code, request.to.code, request.date);
  APP_STATE.currentSearchData = searchData;
  APP_STATE.currentResults = [...searchData.flights];
  applyFiltersAndSort();

  if (searchData.mode === 'nearby') {
    showToast(searchData.searchNotice);
  }
}

function runFilterUI() {
  const groups = Array.from(document.querySelectorAll('.filter-group'));
  const nextFilters = { price: [], airlines: [], stops: [], baggage: [] };

  groups.forEach(group => {
    const label = group.querySelector('.label-left')?.innerText || '';
    const checked = Array.from(group.querySelectorAll('input[type="checkbox"]:checked'))
      .map(input => input.nextElementSibling?.innerText.trim())
      .filter(Boolean);
    if (label.includes('价格')) nextFilters.price = checked;
    if (label.includes('航空')) nextFilters.airlines = checked;
    if (label.includes('中转')) nextFilters.stops = checked;
    if (label.includes('行李')) nextFilters.baggage = checked;
  });

  APP_STATE.filters = nextFilters;
  APP_STATE.sort = document.getElementById('sort-select')?.value || 'recommend';
  applyFiltersAndSort();
}

function applyFiltersAndSort() {
  if (!APP_STATE.currentSearchData) return;

  let results = [...safeArray(APP_STATE.currentSearchData.flights)];
  const { price, airlines, stops, baggage } = APP_STATE.filters;

  if (airlines.length) {
    results = results.filter(flight => airlines.includes(flight.airline));
  }

  if (price.length) {
    results = results.filter(flight => {
      if (price.includes('¥1000 以下') && flight.price < 1000) return true;
      if (price.includes('¥1000 - ¥3000') && flight.price >= 1000 && flight.price <= 3000) return true;
      if (price.includes('¥3000 以上') && flight.price > 3000) return true;
      return false;
    });
  }

  if (stops.length) {
    results = results.filter(flight => {
      const stopCount = Number(flight.stopCount || 0);
      if (stops.includes('直飞') && stopCount === 0) return true;
      if (stops.includes('1 次中转') && stopCount === 1) return true;
      if (stops.includes('2 次及以上') && stopCount >= 2) return true;
      return false;
    });
  }

  if (baggage.length) {
    results = results.filter(flight => {
      if (baggage.includes('含免费托运') && hasFreeBaggage(flight)) return true;
      if (baggage.includes('仅手提行李') && isCarryOnOnly(flight)) return true;
      return false;
    });
  }

  results.sort((left, right) => {
    if (APP_STATE.sort === 'price-asc') return left.price - right.price;
    if (APP_STATE.sort === 'time-asc') return Number(left.departure.time.replace(':', '')) - Number(right.departure.time.replace(':', ''));
    if (APP_STATE.sort === 'duration-asc') return parseDurationMinutes(left.durationText, left.durationMin) - parseDurationMinutes(right.durationText, right.durationMin);
    return computeFlightScore(right) - computeFlightScore(left);
  });

  APP_STATE.currentResults = results;
  renderFlights({ ...APP_STATE.currentSearchData, flights: results });
}

function addMonitor(payload) {
  APP_STATE.monitors = safeArray(APP_STATE.monitors);
  const exists = APP_STATE.monitors.some(monitor => monitor.from.code === payload.fromCode && monitor.to.code === payload.toCode);
  if (exists) {
    showToast('这条路线已经在监控列表里了');
    return;
  }

  const monitor = normalizeMonitor({
    id: `monitor_${Date.now()}`,
    from: { code: payload.fromCode, city: payload.from },
    to: { code: payload.toCode, city: payload.to },
    airline: payload.airline || `${payload.from} → ${payload.to}`,
    currentPrice: payload.currentPrice,
    targetPrice: payload.targetPrice || Math.round(payload.currentPrice * 0.9),
    status: payload.currentPrice <= payload.targetPrice ? 'below_target' : 'monitoring',
    badge: payload.currentPrice <= payload.targetPrice ? '已低于目标价' : '',
    trend: [58, 55, 62, 50, 47, 43, 39],
    lastUpdated: '刚刚',
    bookingUrl: payload.bookingUrl || buildBookingUrl(payload.source || '携程', {
      from: { code: payload.fromCode, city: payload.from },
      to: { code: payload.toCode, city: payload.to }
    }, payload.departDate || getRecommendedDate())
  }, APP_STATE.monitors.length);

  APP_STATE.monitors.unshift(monitor);
  saveAppState();
  renderMonitors({ monitors: APP_STATE.monitors, stats: APP_STATE.monitorStats || MOCK.monitors.stats });
  renderQuickStatus(APP_STATE.dealsData || MOCK.deals, { monitors: APP_STATE.monitors, stats: APP_STATE.monitorStats || MOCK.monitors.stats });
  renderProfileStats();
  showToast('目标价监控已保存，接近你的心理价位时再回来做决定');
}

function addQuickMonitor() {
  const context = APP_STATE.currentSearchData || {
    route: {
      from: { code: DEFAULT_SEARCH.from, city: CITY_MAP[DEFAULT_SEARCH.from] },
      to: { code: DEFAULT_SEARCH.to, city: CITY_MAP[DEFAULT_SEARCH.to] }
    },
    effectiveDate: getRecommendedDate(),
    flights: safeArray(APP_STATE.currentResults)
  };
  const leadFlight = safeArray(context.flights)[0];
  addMonitor({
    from: context.route.from.city,
    fromCode: context.route.from.code,
    to: context.route.to.city,
    toCode: context.route.to.code,
    airline: leadFlight?.airline || `${context.route.from.city} → ${context.route.to.city}`,
    currentPrice: leadFlight?.price || 1980,
    targetPrice: leadFlight ? Math.round(leadFlight.price * 0.92) : 1800,
    bookingUrl: leadFlight?.bookingUrl,
    source: leadFlight?.source,
    departDate: context.effectiveDate
  });
  navigateTo('home');
  switchTab('monitor');
}

function addMonitorFromDetail() {
  const flight = APP_STATE.currentDetailFlight;
  if (!flight) return;
  addMonitor({
    from: CITY_MAP[flight.departure.code] || flight.departure.code,
    fromCode: flight.departure.code,
    to: CITY_MAP[flight.arrival.code] || flight.arrival.code,
    toCode: flight.arrival.code,
    airline: flight.airline,
    currentPrice: flight.price,
    targetPrice: Math.round(flight.price * 0.92),
    bookingUrl: flight.bookingUrl,
    source: flight.source,
    departDate: APP_STATE.currentSearchData?.effectiveDate || getRecommendedDate()
  });
}

function focusMonitorRoute(id) {
  const monitor = safeArray(APP_STATE.monitors).find(item => item.id === id);
  if (!monitor) return;

  fillSearchForm({ from: monitor.from, to: monitor.to }, getRecommendedDate());
  navigateTo('home');
  switchTab('explore');
  doSearch();
}

function removeMonitor(button) {
  const card = button.closest('.monitor-card');
  const monitorId = card?.dataset.monitorId;
  if (!monitorId) return;

  APP_STATE.monitors = safeArray(APP_STATE.monitors).filter(monitor => monitor.id !== monitorId);
  saveAppState();
  renderMonitors({ monitors: APP_STATE.monitors, stats: APP_STATE.monitorStats || MOCK.monitors.stats });
  renderQuickStatus(APP_STATE.dealsData || MOCK.deals, { monitors: APP_STATE.monitors, stats: APP_STATE.monitorStats || MOCK.monitors.stats });
  renderProfileStats();
  showToast('已从监控列表移除');
}

async function showFlightDetail(id) {
  navigateTo('detail');
  const detailPayload = await getFlightDetail(id);
  APP_STATE.currentDetailFlight = detailPayload.flight;
  renderDetail(detailPayload);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function handleSubscribe() {
  const input = document.getElementById('sub-email');
  const button = document.getElementById('sub-btn');
  const banner = document.querySelector('.cta-banner');

  if (!input || !input.value.includes('@')) {
    showToast('请输入有效邮箱，用于接收目标价提醒');
    return;
  }

  APP_STATE.isSubscribed = true;
  saveAppState();

  if (button) {
    button.innerText = '已订阅';
    button.style.background = '#2e7d32';
    button.style.boxShadow = '0 4px 16px rgba(46,125,50,0.3)';
  }

  if (banner) {
    banner.style.transition = 'all 0.3s ease';
    banner.style.opacity = '0';
    banner.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      banner.style.display = 'none';
    }, 300);
  }

  showToast('提醒方式已保存，接近目标价时会优先提醒你');
}

function resetExperience() {
  localStorage.removeItem('hjt_monitors');
  localStorage.removeItem('hjt_subscribed');
  showToast('已清空本地体验数据，页面将刷新');
  setTimeout(() => window.location.reload(), 700);
}

function bootAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  setTimeout(() => {
    document.querySelectorAll('.deal-card, .monitor-card, .flight-card, .rule-card').forEach(node => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(20px)';
      node.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(node);
    });
  }, 20);
}

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('input-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = getRecommendedDate();
  }

  if (APP_STATE.isSubscribed) {
    const banner = document.querySelector('.cta-banner');
    if (banner) banner.style.display = 'none';
  }

  const [dealsData, monitorData] = await Promise.all([getDeals(), getMonitors()]);

  renderDeals({ ...dealsData, deals: dealsData.deals.slice(0, 6) });
  renderMonitors(monitorData);
  renderQuickStatus(dealsData, monitorData);

  fillSearchForm(
    {
      from: { code: DEFAULT_SEARCH.from, city: CITY_MAP[DEFAULT_SEARCH.from] },
      to: { code: DEFAULT_SEARCH.to, city: CITY_MAP[DEFAULT_SEARCH.to] }
    },
    dateInput?.value || getRecommendedDate()
  );

  APP_STATE.currentSearchData = await getSearch(DEFAULT_SEARCH.from, DEFAULT_SEARCH.to, dateInput?.value || getRecommendedDate());
  APP_STATE.currentResults = [...APP_STATE.currentSearchData.flights];
  applyFiltersAndSort();
  renderProfileStats();
  bootAnimations();
});

document.addEventListener('click', event => {
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifButton = document.getElementById('notif-btn');
  if (notifDropdown && notifDropdown.classList.contains('show') && !notifDropdown.contains(event.target) && !notifButton.contains(event.target)) {
    notifDropdown.classList.remove('show');
  }

  const userDropdown = document.getElementById('user-dropdown');
  const userButton = document.getElementById('user-menu-btn');
  if (userDropdown && userDropdown.classList.contains('show') && !userDropdown.contains(event.target) && !userButton.contains(event.target)) {
    userDropdown.classList.remove('show');
  }
});
