# 特价机票发现平台 — 后端 API 接口文档

## 架构概述

```
┌─────────────────────┐     fetch JSON      ┌──────────────────────────┐
│  前端 (EdgeOne)      │  ←──────────────→  │  后端 (GitHub Pages)      │
│  index.html          │                    │  /data/*.json             │
│  your-domain.com     │                    │  xxx.github.io/flight-api │
└─────────────────────┘                    └──────────────────────────┘
                                                      ↑
                                            GitHub Actions 定时爬虫
                                            (每小时/每天跑一次)
                                                      ↑
                                           携程 / 飞猪 / 去哪儿 / 航司官网
```

**后端本质上就是一个静态 JSON 文件托管**，由 GitHub Actions 定时更新。前端直接 fetch 这些 JSON 文件。

---

## 前端配置

前端 `index.html` 顶部有一个 `API_CONFIG` 对象：

```javascript
const API_CONFIG = {
  BASE_URL: 'https://xxx.github.io/flight-api/data',
  // 或者: 'https://your-api.your-domain.com/data'
  USE_MOCK: true  // 设为 false 启用真实数据
};
```

**对接步骤：**
1. 后端准备好 JSON 文件并部署到 GitHub Pages
2. 将 `BASE_URL` 改为你的 GitHub Pages 地址
3. 将 `USE_MOCK` 改为 `false`
4. 完成对接

---

## 接口列表

### 1. 首页特价推荐

**文件路径**: `/data/deals.json`

**用途**: 首页「今日必看特价」卡片列表

**响应格式**:

```json
{
  "updatedAt": "2026-04-10T14:00:00Z",
  "deals": [
    {
      "id": "deal_001",
      "from": {
        "code": "SHA",
        "city": "上海"
      },
      "to": {
        "code": "KIX",
        "city": "京都"
      },
      "airline": "全日空航空",
      "price": 1280,
      "originalPrice": 5400,
      "discount": "2.3折",
      "tags": ["直飞", "限改签"],
      "hotTag": "仅剩 5 张",
      "departDate": "2026-04-20",
      "imageUrl": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=400&fit=crop",
      "bookingUrl": "https://flights.ctrip.com/online/list/oneway-SHA-KIX?depdate=2026-04-20",
      "source": "携程",
      "priceStatus": "当前价格处于近三月最低点",
      "priceStatusPercent": 25
    }
  ]
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| `id` | string | ✅ | 唯一标识 |
| `from.code` | string | ✅ | 出发城市 IATA 代码 |
| `from.city` | string | ✅ | 出发城市中文名 |
| `to.code` | string | ✅ | 目的城市 IATA 代码 |
| `to.city` | string | ✅ | 目的城市中文名 |
| `airline` | string | ✅ | 航司名称 |
| `price` | number | ✅ | 当前价格（元） |
| `originalPrice` | number | ✅ | 历史均价/原价（元） |
| `discount` | string | ✅ | 折扣文案，如 "2.3折" |
| `tags` | string[] | ✅ | 标签列表。可选值: `"直飞"`, `"限改签"`, `"不可退改"`, `"可退票"`, `"含行李"` |
| `hotTag` | string | ❌ | 紧迫性文案，如 `"仅剩 5 张"`, `"限时大促"` |
| `departDate` | string | ✅ | 出发日期 YYYY-MM-DD |
| `imageUrl` | string | ✅ | 目的地城市图片 URL（建议 600×400） |
| `bookingUrl` | string | ✅ | **购票链接**（携程/飞猪/去哪儿等） |
| `source` | string | ✅ | 数据来源名称，如 `"携程"`, `"飞猪"` |
| `priceStatus` | string | ❌ | 价格状态文案 |
| `priceStatusPercent` | number | ❌ | 价格状态条百分比 (0-100) |

---

### 2. 航班搜索结果

**文件路径**: `/data/search/{from}-{to}.json`

**示例**: `/data/search/SHA-PEK.json`

**用途**: 搜索结果页的航班列表 + 价格趋势

**响应格式**:

```json
{
  "updatedAt": "2026-04-10T14:00:00Z",
  "route": {
    "from": { "code": "SHA", "city": "上海" },
    "to": { "code": "PEK", "city": "北京" }
  },
  "trend": {
    "lowestPrice": 2340,
    "hint": "当前处于价格低位，建议立即预订",
    "bars": [
      { "day": "1", "height": 55, "type": "normal" },
      { "day": "2", "height": 65, "type": "normal" },
      { "day": "3", "height": 70, "type": "normal" },
      { "day": "4", "height": 45, "type": "low" },
      { "day": "今天", "height": 38, "type": "today" },
      { "day": "6", "height": 65, "type": "normal" }
    ]
  },
  "flights": [
    {
      "id": "flight_001",
      "airline": "中国东方航空",
      "flightNo": "MU5101",
      "aircraft": "波音 777-300ER",
      "departure": {
        "time": "08:00",
        "airport": "SHA"
      },
      "arrival": {
        "time": "10:20",
        "airport": "PEK"
      },
      "durationMin": 140,
      "durationText": "2 小时 20 分",
      "direct": true,
      "onTimeRate": 94,
      "price": 2480,
      "originalPrice": 3120,
      "services": [
        { "icon": "restaurant", "label": "精品正餐", "available": true },
        { "icon": "luggage",    "label": "23KG×2",   "available": true },
        { "icon": "wifi",       "label": "机上WiFi",  "available": true }
      ],
      "valueScore": 9.8,
      "badge": "性价比指数 9.8",
      "badgeType": "value",
      "bookingUrl": "https://flights.ctrip.com/online/list/oneway-SHA-PEK?depdate=2026-04-15&cabin=y&adult=1",
      "source": "携程"
    }
  ]
}
```

**航班字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|:-----|:-----|:-----|:-----|
| `id` | string | ✅ | 唯一标识 |
| `airline` | string | ✅ | 航司中文名 |
| `flightNo` | string | ✅ | 航班号 |
| `aircraft` | string | ❌ | 机型 |
| `departure.time` | string | ✅ | 出发时间 HH:mm |
| `departure.airport` | string | ✅ | 出发机场 IATA |
| `arrival.time` | string | ✅ | 到达时间 HH:mm |
| `arrival.airport` | string | ✅ | 到达机场 IATA |
| `durationMin` | number | ✅ | 飞行时长（分钟） |
| `durationText` | string | ✅ | 飞行时长文案 |
| `direct` | boolean | ✅ | 是否直飞 |
| `onTimeRate` | number | ❌ | 准点率 (0-100) |
| `price` | number | ✅ | 当前价格 |
| `originalPrice` | number | ❌ | 原价 |
| `services` | array | ❌ | 服务列表 |
| `valueScore` | number | ❌ | 性价比评分 (0-10) |
| `badge` | string | ❌ | 卡片角标文案 |
| `badgeType` | string | ❌ | 角标类型: `"value"` / `"business"` |
| `bookingUrl` | string | ✅ | **购票链接** |
| `source` | string | ✅ | 数据来源 |

---

### 3. 航班详情

**文件路径**: `/data/flights/{id}.json`

**示例**: `/data/flights/flight_001.json`

**用途**: 航班详情页全部信息

**响应格式**:

```json
{
  "updatedAt": "2026-04-10T14:00:00Z",
  "flight": {
    "id": "flight_001",
    "airline": "中国东方航空",
    "flightNo": "MU587",
    "aircraft": "波音 777-300ER",
    "departure": {
      "time": "09:45",
      "code": "PVG",
      "airport": "上海浦东国际机场",
      "terminal": "T2"
    },
    "arrival": {
      "time": "12:15",
      "code": "JFK",
      "airport": "纽约肯尼迪国际机场",
      "terminal": "T4"
    },
    "durationText": "12 小时 30 分",
    "direct": true,
    "price": 8240,
    "originalPrice": 12480,
    "cabin": "经济舱 (R)",
    "seatsLeft": 3,
    "priceBreakdown": {
      "base": 7100,
      "tax": 1140,
      "total": 8240
    },
    "rules": {
      "baggage": {
        "title": "行李额度",
        "detail": "包含 23kg 托运行李 × 1 件\n及 7kg 手提行李 × 1 件",
        "icon": "luggage"
      },
      "refund": {
        "title": "退改政策",
        "detail": "起飞前不可改签\n退票手续费 ¥2,500 起",
        "icon": "swap_horiz"
      },
      "service": {
        "title": "机上服务",
        "detail": "提供两次正餐与点心\n全机位配备充电插座",
        "icon": "airline_seat_recline_extra"
      }
    },
    "priceTrend": [
      { "price": 9200, "height": 70 },
      { "price": 8800, "height": 65 },
      { "price": 8500, "height": 60 },
      { "price": 9500, "height": 72 },
      { "price": 6800, "height": 35, "isLowest": true },
      { "price": 8240, "height": 52, "isToday": true }
    ],
    "historicalLowest": 6800,
    "similarRoutes": [
      {
        "from": "PVG",
        "to": "BOS",
        "toCity": "波士顿",
        "date": "4月12日",
        "info": "转机 1 次 · 含行李",
        "price": 7450,
        "imageUrl": "https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=100&h=100&fit=crop",
        "bookingUrl": "https://flights.ctrip.com/online/list/oneway-PVG-BOS"
      }
    ],
    "bookingUrl": "https://flights.ctrip.com/online/list/oneway-PVG-JFK?depdate=2026-04-15",
    "source": "携程",
    "bestPriceBadge": "最佳票价"
  }
}
```

---

### 4. 监控列表

**文件路径**: `/data/monitors.json`

**用途**: 「我的监控」Tab 展示用户订阅的航线

> 注意：真正的用户个人订阅需要用户系统。MVP 阶段可以用 localStorage 存储，或者展示全局热门监控航线。

**响应格式**:

```json
{
  "updatedAt": "2026-04-10T14:00:00Z",
  "monitors": [
    {
      "id": "mon_001",
      "from": { "code": "SHA", "city": "上海" },
      "to": { "code": "HND", "city": "东京" },
      "airline": "全日空航空 · 往返",
      "targetPrice": 2800,
      "currentPrice": 2450,
      "status": "below_target",
      "badge": "当前最低",
      "trend": [60, 75, 55, 80, 65, 45, 35],
      "lastUpdated": "2 分钟前",
      "highlight": false,
      "bookingUrl": "https://flights.ctrip.com/online/list/roundtrip-SHA-HND"
    }
  ],
  "stats": {
    "todayDeals": 8429,
    "partners": 120
  }
}
```

**status 枚举值**:

| 值 | 含义 | 前端表现 |
|:---|:-----|:---------|
| `below_target` | 低于目标价 | 绿色价格，显示「立即预订」 |
| `near_target` | 接近目标价 | 高亮卡片，显示提示信息 |
| `above_target` | 高于目标价 | 橙色价格，显示「修改监控」 |

---

## 购票链接格式参考

后端爬虫生成 `bookingUrl` 时，可参考以下格式：

### 携程
```
# 单程
https://flights.ctrip.com/online/list/oneway-{出发城市代码}-{到达城市代码}?depdate={YYYY-MM-DD}&cabin=y&adult=1

# 往返
https://flights.ctrip.com/online/list/roundtrip-{出发}-{到达}?depdate={去程日期}&rdate={回程日期}
```

### 飞猪
```
https://s.taobao.com/search?q=机票+{出发城市}+{到达城市}
```

### 去哪儿
```
https://flight.qunar.com/site/oneway_list.htm?searchDepartureAirport={出发城市}&searchArrivalAirport={到达城市}&searchDepartureTime={YYYY-MM-DD}
```

### 航司官网
```
# 直接提供航司特价页面或具体订票链接
```

> **建议**: 优先使用爬取到特价信息的原始页面 URL 作为 bookingUrl，确保用户点击后能直达对应平台的最佳价格。

---

## GitHub Actions 爬虫建议

```yaml
# .github/workflows/crawl.yml
name: Crawl Flight Deals
on:
  schedule:
    - cron: '0 */2 * * *'  # 每2小时跑一次
  workflow_dispatch:        # 支持手动触发

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install requests beautifulsoup4
      - run: python scripts/crawl.py
      - run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/
          git diff --staged --quiet || git commit -m "Update flight data"
          git push
```

**输出目录结构**:
```
data/
├── deals.json              ← 首页特价
├── monitors.json           ← 监控航线
├── search/
│   ├── SHA-PEK.json        ← 上海→北京 搜索结果
│   ├── SHA-KIX.json        ← 上海→京都
│   └── PEK-SYD.json        ← 北京→悉尼
└── flights/
    ├── flight_001.json     ← 航班详情
    ├── flight_002.json
    └── flight_003.json
```

---

## CORS 配置

如果后端使用 GitHub Pages，默认已支持 CORS，前端可以直接 fetch。

如果使用自建服务器，需要添加响应头：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
```

---

## 版本信息

- 接口版本: v1
- 最后更新: 2026-04-10
- 前端对接人: [你的名字]
- 后端对接人: [后端同学]
