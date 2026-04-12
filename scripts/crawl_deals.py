import json
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
SEARCH_DIR = DATA_DIR / "search"
FLIGHTS_DIR = DATA_DIR / "flights"
RNG = random.Random(20260412)


def iso_now():
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def date_after(days):
    return (datetime.now(UTC) + timedelta(days=days)).strftime("%Y-%m-%d")


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def build_booking_url(source, from_code, to_code, from_city, to_city, depart_date):
    if source == "飞猪":
        return (
            "https://www.fliggy.com/redirect?type=5&searchQuery="
            f"{from_city}-{to_city}&departDate={depart_date}"
        )
    if source == "去哪儿":
        return (
            "https://flight.qunar.com/site/oneway_list.htm?"
            f"searchDepartureAirport={from_city}&searchArrivalAirport={to_city}"
            f"&searchDepartureTime={depart_date}"
        )
    return f"https://flights.ctrip.com/online/list/oneway-{from_code}-{to_code}?depdate={depart_date}"


def build_price_history(base_price, days=14):
    history = []
    for offset in range(days, -1, -1):
        date_label = (datetime.now(UTC) - timedelta(days=offset)).strftime("%m-%d")
        wave = 0.78 + RNG.random() * 0.34
        history.append({"date": date_label, "price": int(base_price * wave)})
    return history


def build_discount(price, original_price):
    if not original_price or original_price <= price:
        original_price = int(price * 1.25)
    return f"{price / original_price * 10:.1f}折"


def infer_price_status(price, history):
    prices = [entry["price"] for entry in history] or [price]
    avg_price = sum(prices) / len(prices)
    delta = max(1, round((avg_price - price) / avg_price * 100))
    return {
        "priceStatus": f"当前价格较近两周均价低 {delta}%",
        "priceStatusPercent": min(42, max(16, delta)),
    }


def build_deal(template):
    depart_date = date_after(template["offset"])
    price = int(template["basePrice"] * template["priceFactor"])
    original_price = template.get("originalPrice", int(price * 1.35))
    price_history = build_price_history(original_price)
    status_meta = infer_price_status(price, price_history)
    return {
        "id": template["id"],
        "from": {"code": template["fromCode"], "city": template["fromCity"]},
        "to": {"code": template["toCode"], "city": template["toCity"]},
        "airline": template["airline"],
        "departDate": depart_date,
        "price": price,
        "originalPrice": original_price,
        "discount": build_discount(price, original_price),
        "source": template["source"],
        "tags": template["tags"],
        "recommendation": template["recommendation"],
        "recommendationReason": template["recommendationReason"],
        "imageUrl": template["imageUrl"],
        "bookingUrl": build_booking_url(
            template["source"],
            template["fromCode"],
            template["toCode"],
            template["fromCity"],
            template["toCity"],
            depart_date,
        ),
        "region": template["region"],
        "hotTag": template.get("hotTag", ""),
        "priceHistory": price_history,
        "updatedAt": iso_now(),
        **status_meta,
    }


def build_trend_bars(price_history):
    prices = [entry["price"] for entry in price_history]
    lowest = min(prices)
    highest = max(prices)
    spread = max(1, highest - lowest)
    bars = []
    for idx, entry in enumerate(price_history):
        normalized = (entry["price"] - lowest) / spread
        bars.append(
            {
                "date": entry["date"],
                "price": entry["price"],
                "height": 30 + int(normalized * 55),
                "isToday": idx == len(price_history) - 1,
                "isLowest": entry["price"] == lowest,
            }
        )
    return lowest, bars


def build_search_payload(route, flights, notice):
    normalized_flights = []
    for index, flight in enumerate(flights):
        depart_date = route["departDate"]
        booking_url = build_booking_url(
            flight["source"],
            route["from"]["code"],
            route["to"]["code"],
            route["from"]["city"],
            route["to"]["city"],
            depart_date,
        )
        price_history = build_price_history(flight["originalPrice"])
        normalized_flights.append(
            {
                "id": flight["id"],
                "departDate": depart_date,
                "airline": flight["airline"],
                "flightNo": flight["flightNo"],
                "aircraft": flight["aircraft"],
                "departure": {
                    "code": route["from"]["code"],
                    "airport": f'{route["from"]["city"]}机场',
                    "time": flight["departureTime"],
                },
                "arrival": {
                    "code": route["to"]["code"],
                    "airport": f'{route["to"]["city"]}机场',
                    "time": flight["arrivalTime"],
                },
                "durationMin": flight["durationMin"],
                "durationText": flight["durationText"],
                "direct": flight.get("direct", True),
                "stopCount": flight.get("stopCount", 0),
                "onTimeRate": flight["onTimeRate"],
                "price": flight["price"],
                "originalPrice": flight["originalPrice"],
                "tags": flight["tags"],
                "services": flight["services"],
                "recommendation": flight["recommendation"],
                "recommendationReason": flight["recommendationReason"],
                "badge": flight.get("badge", ""),
                "badgeType": flight.get("badgeType", ""),
                "source": flight["source"],
                "bookingUrl": booking_url,
                "priceHistory": price_history,
                "updatedAt": iso_now(),
            }
        )

    lowest_price, bars = build_trend_bars(normalized_flights[0]["priceHistory"])
    return {
        "updatedAt": iso_now(),
        "route": {"from": route["from"], "to": route["to"]},
        "requestedDate": route["departDate"],
        "effectiveDate": route["departDate"],
        "notice": notice,
        "trendConclusion": "已按价格、退改限制、准点率综合排序，优先展示更值得点击的选项",
        "trend": {
            "lowestPrice": lowest_price,
            "hint": "近 15 天价格走势",
            "bars": bars,
        },
        "flights": normalized_flights,
    }


def build_detail_payload(route, flight):
    baggage_text = "含免费托运" if any("托运" in tag or "行李" in tag for tag in flight["tags"]) else "仅含手提行李"
    refund_text = "限制较少，可按平台规则改退" if any("可退" in tag or "可改" in tag for tag in flight["tags"]) else "折扣票规则严格，改退前请核对平台说明"
    price_history = flight["priceHistory"]
    lowest_price, _ = build_trend_bars(price_history)
    current_price = flight["price"]
    base_amount = int(current_price * 0.87)
    tax_amount = current_price - base_amount
    return {
        "updatedAt": iso_now(),
        "flight": {
            "id": flight["id"],
            "airline": flight["airline"],
            "flightNo": flight["flightNo"],
            "aircraft": flight["aircraft"],
            "departure": {
                "time": flight["departure"]["time"],
                "code": route["from"]["code"],
                "airport": f'{route["from"]["city"]}国际机场',
                "terminal": "T2",
            },
            "arrival": {
                "time": flight["arrival"]["time"],
                "code": route["to"]["code"],
                "airport": f'{route["to"]["city"]}国际机场',
                "terminal": "T1",
            },
            "durationText": flight["durationText"],
            "direct": flight["direct"],
            "price": current_price,
            "originalPrice": flight["originalPrice"],
            "cabin": "经济舱",
            "seatsLeft": 3 + RNG.randint(0, 4),
            "priceBreakdown": {"base": base_amount, "tax": tax_amount, "total": current_price},
            "rules": {
                "baggage": {
                    "title": "行李额度",
                    "detail": baggage_text,
                    "icon": "luggage",
                },
                "refund": {
                    "title": "退改规则",
                    "detail": refund_text,
                    "icon": "swap_horiz",
                },
                "service": {
                    "title": "机上体验",
                    "detail": "展示餐食、准点率、机上设施等决策信息",
                    "icon": "airline_seat_recline_extra",
                },
            },
            "priceTrend": [
                {"height": 28 + int((entry["price"] - lowest_price) / max(1, flight["originalPrice"] - lowest_price) * 60), "isLowest": entry["price"] == lowest_price, "isToday": idx == len(price_history) - 1}
                for idx, entry in enumerate(price_history)
            ],
            "historicalLowest": lowest_price,
            "similarRoutes": [],
            "bookingUrl": flight["bookingUrl"],
            "source": flight["source"],
            "bestPriceBadge": flight.get("badge") or flight["recommendation"],
            "updatedAt": iso_now(),
        }
    }


DEAL_TEMPLATES = [
    {
        "id": "deal_sha_hgh",
        "fromCode": "SHA",
        "fromCity": "上海",
        "toCode": "HGH",
        "toCity": "杭州",
        "basePrice": 580,
        "priceFactor": 0.79,
        "source": "携程",
        "airline": "南方航空",
        "tags": ["直飞", "极速出票"],
        "recommendation": "高性价比",
        "recommendationReason": "高铁替代场景里更省时间，价格仍有优势",
        "imageUrl": "https://images.unsplash.com/photo-1558422719-d6982435e4e4?w=800",
        "region": "domestic",
        "offset": 11,
        "hotTag": "本周末出发",
    },
    {
        "id": "deal_pek_can",
        "fromCode": "PEK",
        "fromCity": "北京",
        "toCode": "CAN",
        "toCity": "广州",
        "basePrice": 1080,
        "priceFactor": 0.76,
        "source": "飞猪",
        "airline": "中国国航",
        "tags": ["直飞", "含托运"],
        "recommendation": "最省时",
        "recommendationReason": "热门商务线，直飞且总价压到均线下方",
        "imageUrl": "https://images.unsplash.com/photo-1563090162-6b4c2a20d658?w=800",
        "region": "domestic",
        "offset": 13,
        "hotTag": "工作日低位",
    },
    {
        "id": "deal_ctu_szx",
        "fromCode": "CTU",
        "fromCity": "成都",
        "toCode": "SZX",
        "toCity": "深圳",
        "basePrice": 920,
        "priceFactor": 0.81,
        "source": "去哪儿",
        "airline": "深圳航空",
        "tags": ["准点率高", "含餐食"],
        "recommendation": "体验更稳",
        "recommendationReason": "适合不想为了低价牺牲准点率的用户",
        "imageUrl": "https://images.unsplash.com/photo-1522614288668-a697127e9b21?w=800",
        "region": "domestic",
        "offset": 17,
    },
    {
        "id": "deal_sha_kix",
        "fromCode": "SHA",
        "fromCity": "上海",
        "toCode": "KIX",
        "toCity": "大阪",
        "basePrice": 2180,
        "priceFactor": 0.63,
        "source": "携程",
        "airline": "吉祥航空",
        "tags": ["直飞", "不可退改"],
        "recommendation": "最省钱",
        "recommendationReason": "樱花季热门线仍处于低位，适合快速锁票",
        "imageUrl": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800",
        "region": "intl",
        "offset": 9,
        "hotTag": "日本线热门",
    },
    {
        "id": "deal_pek_syd",
        "fromCode": "PEK",
        "fromCity": "北京",
        "toCode": "SYD",
        "toCity": "悉尼",
        "basePrice": 4580,
        "priceFactor": 0.57,
        "source": "飞猪",
        "airline": "南方航空",
        "tags": ["含行李", "可退改"],
        "recommendation": "限制最少",
        "recommendationReason": "长线票价有吸引力，同时退改空间更友好",
        "imageUrl": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800",
        "region": "intl",
        "offset": 18,
        "hotTag": "长线精选",
    },
    {
        "id": "deal_can_cdg",
        "fromCode": "CAN",
        "fromCity": "广州",
        "toCode": "CDG",
        "toCity": "巴黎",
        "basePrice": 6990,
        "priceFactor": 0.61,
        "source": "去哪儿",
        "airline": "东方航空",
        "tags": ["直飞", "含餐食"],
        "recommendation": "飞行更省心",
        "recommendationReason": "直飞节省中转损耗，适合第一次去欧洲的用户",
        "imageUrl": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
        "region": "intl",
        "offset": 21,
    },
]


SEARCH_SCENARIOS = [
    {
        "fileName": "SHA-PEK.json",
        "route": {
            "from": {"code": "SHA", "city": "上海"},
            "to": {"code": "PEK", "city": "北京"},
            "departDate": date_after(7),
        },
        "notice": "已按价格、退改规则、准点率综合排序，先帮你判断值不值得点进去",
        "flights": [
            {
                "id": "flight_001",
                "airline": "中国东方航空",
                "flightNo": "MU5101",
                "aircraft": "波音 777-300ER",
                "departureTime": "08:00",
                "arrivalTime": "10:20",
                "durationMin": 140,
                "durationText": "2 小时 20 分",
                "price": 2480,
                "originalPrice": 3180,
                "source": "携程",
                "tags": ["直飞", "含托运23kg", "不可退改"],
                "services": [
                    {"icon": "restaurant", "label": "精品正餐", "available": True},
                    {"icon": "luggage", "label": "23KG 托运", "available": True},
                    {"icon": "wifi", "label": "机上 WiFi", "available": True},
                ],
                "recommendation": "推荐优先",
                "recommendationReason": "价格低于均价，且准点率稳定",
                "badge": "推荐优先",
                "badgeType": "cheapest",
                "onTimeRate": 94,
            },
            {
                "id": "flight_002",
                "airline": "中国国际航空",
                "flightNo": "CA1502",
                "aircraft": "空客 A350-900",
                "departureTime": "12:30",
                "arrivalTime": "14:45",
                "durationMin": 135,
                "durationText": "2 小时 15 分",
                "price": 2620,
                "originalPrice": 2890,
                "source": "携程",
                "tags": ["直飞", "含托运23kg", "可改签"],
                "services": [
                    {"icon": "restaurant", "label": "精致点心", "available": True},
                    {"icon": "luggage", "label": "23KG 托运", "available": True},
                    {"icon": "bolt", "label": "优先值机", "available": True},
                ],
                "recommendation": "最稳妥",
                "recommendationReason": "准点率高，限制更少",
                "badge": "最稳妥",
                "badgeType": "safest",
                "onTimeRate": 98,
            },
            {
                "id": "flight_003",
                "airline": "南方航空",
                "flightNo": "CZ3116",
                "aircraft": "空客 A330",
                "departureTime": "16:45",
                "arrivalTime": "19:15",
                "durationMin": 150,
                "durationText": "2 小时 30 分",
                "price": 1850,
                "originalPrice": 2290,
                "source": "去哪儿",
                "tags": ["直飞", "仅手提行李", "不可退改"],
                "services": [
                    {"icon": "no_meals", "label": "不含餐食", "available": False},
                    {"icon": "luggage", "label": "仅 10KG 手提", "available": True},
                ],
                "recommendation": "最低价",
                "recommendationReason": "价格最低，但限制更多，适合轻装出行",
                "badge": "",
                "badgeType": "",
                "onTimeRate": 78,
            },
        ],
    },
]


MONITORS_PAYLOAD = {
    "updatedAt": iso_now(),
    "monitors": [
        {
            "id": "mon_001",
            "from": {"code": "SHA", "city": "上海"},
            "to": {"code": "HND", "city": "东京"},
            "airline": "全日空航空 · 往返",
            "targetPrice": 2800,
            "currentPrice": 2450,
            "status": "below_target",
            "badge": "已低于目标价",
            "trend": [60, 75, 55, 80, 65, 45, 35],
            "lastUpdated": "12 分钟前",
            "highlight": False,
            "bookingUrl": build_booking_url("携程", "SHA", "HND", "上海", "东京", date_after(12)),
        },
        {
            "id": "mon_002",
            "from": {"code": "PEK", "city": "北京"},
            "to": {"code": "LHR", "city": "伦敦"},
            "airline": "英国航空 · 单程",
            "targetPrice": 4500,
            "currentPrice": 5120,
            "status": "above_target",
            "badge": "",
            "trend": [50, 60, 55, 58, 62, 60, 58],
            "lastUpdated": "1 小时前",
            "highlight": False,
            "bookingUrl": build_booking_url("携程", "PEK", "LHR", "北京", "伦敦", date_after(15)),
        },
        {
            "id": "mon_003",
            "from": {"code": "CAN", "city": "广州"},
            "to": {"code": "CDG", "city": "巴黎"},
            "airline": "多平台监控中",
            "targetPrice": 3900,
            "currentPrice": 4050,
            "status": "near_target",
            "badge": "接近目标",
            "trend": [],
            "lastUpdated": "刚刚",
            "highlight": True,
            "bookingUrl": build_booking_url("去哪儿", "CAN", "CDG", "广州", "巴黎", date_after(20)),
        },
    ],
    "stats": {"todayDeals": 428, "partners": 3},
}


def main():
    print("航价通 - 生成演示数据契约...")

    deals = [build_deal(template) for template in DEAL_TEMPLATES]
    deals_payload = {"updatedAt": iso_now(), "count": len(deals), "deals": deals}
    write_json(DATA_DIR / "deals.json", deals_payload)

    all_detail_payloads = []
    for scenario in SEARCH_SCENARIOS:
        payload = build_search_payload(scenario["route"], scenario["flights"], scenario["notice"])
        write_json(SEARCH_DIR / scenario["fileName"], payload)
        for flight in payload["flights"]:
            detail_payload = build_detail_payload(payload["route"], flight)
            all_detail_payloads.append(detail_payload)
            write_json(FLIGHTS_DIR / f'{flight["id"]}.json', detail_payload)

    write_json(DATA_DIR / "monitors.json", MONITORS_PAYLOAD)

    print(f"已生成 {len(deals)} 条特价航线")
    print(f"已生成 {len(SEARCH_SCENARIOS)} 个搜索场景")
    print(f"已生成 {len(all_detail_payloads)} 个航班详情文件")
    print("演示数据已写入 data/ 目录")


if __name__ == "__main__":
    main()
