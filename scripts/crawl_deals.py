"""
航价通 - 特价机票抓取脚本模板
作者：[后端同学的名字]

说明：
这个脚本由 GitHub Actions 定时触发（每 6 小时）。
职责是负责抓取/请求特价机票数据，并把结果覆盖写入到 `data/deals.json` 中。
如果使用的是 Kiwi Tequila API 或第三方代理，可以在 `.github/workflows/update-data.yml` 中配置环境变量。

目标 JSON 格式必须严格匹配 `API_DOCS.md` 中的 `GET /data/deals.json` 契约规范。
"""

import os
import json
from datetime import datetime
import requests

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

def fetch_kiwi_deals():
    """
    示例：从 Kiwi API 获取国际特价机票的逻辑，由后端同学实现。
    """
    api_key = os.getenv('API_KEY')
    if not api_key:
        print("Warning: API_KEY not set")
        return []
    
    # TO DO: 接入真实的请求逻辑
    # response = requests.get(...)
    # return parse_deals(response.json())
    return []

def main():
    print("开始抓取最新特价航班数据...")
    
    # 最终要写入的数据结构
    deals_data = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "deals": []
    }
    
    # TODO: 后端同学在这里接入具体的爬虫/API逻辑
    # 例如：
    # deals_data["deals"].extend(fetch_ctrip_mock())
    # deals_data["deals"].extend(fetch_kiwi_deals())
    
    # 为了演示，如果没抓到任何数据，给一个默认的测试数据
    if not deals_data["deals"]:
        deals_data["deals"] = [
            {
                "id": "deal_test",
                "from": { "code": "SHA", "city": "上海" },
                "to": { "code": "KIX", "city": "大阪" },
                "airline": "自动抓取系统测试",
                "price": 999,
                "originalPrice": 2500,
                "discount": "3.9折",
                "tags": ["直飞", "自动更新测试"],
                "hotTag": "自动更新正常",
                "departDate": "2026-05-01",
                "imageUrl": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=400&fit=crop",
                "bookingUrl": "https://flight.qunar.com/site/oneway_list.htm?searchDepartureAirport=%E4%B8%8A%E6%B5%B7&searchArrivalAirport=%E5%A4%A7%E9%98%AA&searchDepartureTime=2026-04-20",
                "source": "去哪儿",
                "recommendation": "系统正常",
                "recommendationReason": "GitHub Actions 定时任务运行正常",
                "priceStatus": "测试数据，非真实价格",
                "priceStatusPercent": 0,
                "updatedAt": datetime.utcnow().isoformat() + "Z"
            }
        ]
        
    # 保存到 data/deals.json
    os.makedirs(DATA_DIR, exist_ok=True)
    out_file = os.path.join(DATA_DIR, 'deals.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(deals_data, f, ensure_ascii=False, indent=2)
        
    print(f"数据抓取完成，已写入 {out_file}，共 {len(deals_data['deals'])} 条数据。")

if __name__ == '__main__':
    main()
