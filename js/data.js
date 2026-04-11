/* =============================================
   APP DATA — CITY MAPS & MOCK DATA
   ============================================= */

const CITY_MAP = {
  // 国内主要城市
  "BJS": "北京", "PEK": "北京", "PKX": "北京",
  "SHA": "上海", "PVG": "上海", "SHA": "上海",
  "CAN": "广州", "SZX": "深圳", "CTU": "成都", "TFU": "成都",
  "CKG": "重庆", "HGH": "杭州", "XIY": "西安", "KMG": "昆明",
  "SIA": "西安", "CSX": "长沙", "WUH": "武汉", "NKG": "南京",
  "TAO": "青岛", "DLC": "大连", "XMN": "厦门", "SYX": "三亚",
  "HAK": "海口", "URC": "乌鲁木齐", "HRB": "哈尔滨", "TYN": "太原",
  "CGO": "郑州", "TNA": "济南", "NGB": "宁波", "JJN": "泉州",
  
  // 国际主要城市
  "HKG": "香港", "MFM": "澳门", "TPE": "台北", "TSA": "台北",
  "TYO": "东京", "HND": "东京", "NRT": "东京",
  "OSA": "大阪", "KIX": "大阪", "SEL": "首尔", "ICN": "首尔",
  "GMP": "首尔", "SIN": "新加坡", "BKK": "曼谷", "DMK": "曼谷",
  "SGN": "胡志明市", "HAN": "河内", "KUL": "吉隆坡", "MNL": "马尼拉",
  "DPS": "巴厘岛", "SYD": "悉尼", "MEL": "墨尔本", "AKL": "奥克兰",
  "LON": "伦敦", "LHR": "伦敦", "LGW": "伦敦", "PAR": "巴黎",
  "CDG": "巴黎", "ORY": "巴黎", "FRA": "法兰克福", "MUC": "慕尼黑",
  "AMS": "阿姆斯特丹", "ROM": "罗马", "FCO": "罗马", "MAD": "马德里",
  "BCN": "巴塞罗那", "ZRH": "苏黎世", "VIE": "维也纳", "DXB": "迪拜",
  "DOH": "多哈", "IST": "伊斯坦布尔", "NYC": "纽约", "JFK": "纽约",
  "EWR": "纽约", "LGA": "纽约", "SFO": "旧金山", "LAX": "洛杉矶",
  "CHI": "芝加哥", "ORD": "芝加哥", "SEA": "西雅图", "YVR": "温哥华",
  "YYZ": "多伦多", "PER": "珀斯", "BNE": "布里斯班"
};

const MOCK = {
  deals: {
    updatedAt: new Date().toISOString(),
    deals: [
      {
        id: 'deal_001',
        from: { code: 'SHA', city: '上海' },
        to: { code: 'KIX', city: '大阪' },
        airline: '全日空航空',
        price: 1280,
        originalPrice: 5400,
        discount: '2.3折',
        tags: ['直飞', '不可退改', '不含托运'],
        hotTag: '🔥 仅剩 5 张',
        departDate: '2026-04-20',
        imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=400&fit=crop',
        bookingUrl: 'https://flights.ctrip.com/online/list/oneway-SHA-KIX?depdate=2026-04-20',
        source: '携程',
        recommendation: '最省钱',
        recommendationReason: '比近两周均价低 42%',
        priceStatus: '📉 当前价格处于近三月最低点',
        priceStatusPercent: 25,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'deal_002',
        from: { code: 'PEK', city: '北京' },
        to: { code: 'SYD', city: '悉尼' },
        airline: '中国南方航空',
        price: 2340,
        originalPrice: 12800,
        discount: '1.8折',
        tags: ['不可退改', '含托运23kg'],
        hotTag: '⏰ 限时大促',
        departDate: '2026-04-22',
        imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=600&h=400&fit=crop',
        bookingUrl: 'https://www.fliggy.com/redirect?type=5&searchQuery=%E5%8C%97%E4%BA%AC-%E6%82%89%E5%B0%BC&departDate=2026-04-22',
        source: '飞猪',
        recommendation: '限制最少',
        recommendationReason: '含托运行李，税费已含',
        priceStatus: '🔥 限时大促：今日仅剩 3 张',
        priceStatusPercent: 18,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'deal_003',
        from: { code: 'CTU', city: '成都' },
        to: { code: 'DXB', city: '迪拜' },
        airline: '阿联酋航空',
        price: 3150,
        originalPrice: 8900,
        discount: '3.5折',
        tags: ['直飞', '可退票', '含托运30kg'],
        hotTag: '',
        departDate: '2026-04-25',
        imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop',
        bookingUrl: 'https://flight.qunar.com/site/oneway_list.htm?searchDepartureAirport=%E6%88%90%E9%83%BD&searchArrivalAirport=%E8%BF%AA%E6%8B%9C&searchDepartureTime=2026-04-25',
        source: '去哪儿',
        recommendation: '最稳妥',
        recommendationReason: '直飞 + 可退票 + 含行李',
        priceStatus: '✨ 高端舱位特惠中',
        priceStatusPercent: 48,
        updatedAt: new Date().toISOString()
      }
    ]
  },
  search: {
    updatedAt: new Date().toISOString(),
    route: { from: { code: 'SHA', city: '上海' }, to: { code: 'PEK', city: '北京' } },
    trendConclusion: '比近两周均价低 18%，当前处于价格低位，建议出手',
    trend: {
      lowestPrice: 2340,
      hint: '近 18 日价格走势',
      bars: [
        {day:'1',height:55,type:'normal',price:2850,date:'4-01'},{day:'2',height:65,type:'normal',price:2920,date:'4-02'},{day:'3',height:70,type:'normal',price:3050,date:'4-03'},
        {day:'4',height:45,type:'low',price:1850,date:'4-04'},{day:'5',height:60,type:'normal',price:2700,date:'4-05'},{day:'6',height:40,type:'low',price:1620,date:'4-06'},
        {day:'7',height:55,type:'normal',price:2480,date:'4-07'},{day:'8',height:50,type:'normal',price:2300,date:'4-08'},{day:'9',height:58,type:'normal',price:2650,date:'4-09'},
        {day:'今天',height:38,type:'today',price:1450,date:'4-10'},{day:'11',height:65,type:'normal',price:2920,date:'4-11'},{day:'12',height:72,type:'normal',price:3250,date:'4-12'},
        {day:'13',height:68,type:'normal',price:3050,date:'4-13'},{day:'14',height:58,type:'normal',price:2650,date:'4-14'},{day:'15',height:62,type:'normal',price:2800,date:'4-15'},
        {day:'16',height:75,type:'normal',price:3400,date:'4-16'},{day:'17',height:80,type:'normal',price:3650,date:'4-17'},{day:'18',height:70,type:'normal',price:3100,date:'4-18'}
      ]
    },
    flights: [
      {
        id:'flight_001', airline:'中国东方航空', flightNo:'MU5101', aircraft:'波音 777-300ER',
        departure:{time:'08:00',airport:'SHA'}, arrival:{time:'10:20',airport:'PEK'},
        durationMin:140, durationText:'2 小时 20 分', direct:true, onTimeRate:94,
        price:2480, originalPrice:3120,
        tags:['直飞','含托运23kg','不可退改'],
        services:[{icon:'restaurant',label:'精品正餐',available:true},{icon:'luggage',label:'23KG×2',available:true},{icon:'wifi',label:'机上WiFi',available:true}],
        recommendation:'最省钱', recommendationReason:'比近两周均价低 18%', badge:'最省钱', badgeType:'cheapest',
        bookingUrl:'https://flights.ctrip.com/online/list/oneway-SHA-PEK?depdate=2026-04-15', source:'携程', updatedAt: new Date().toISOString()
      },
      {
        id:'flight_002', airline:'中国国际航空', flightNo:'CA1502', aircraft:'空客 A350-900',
        departure:{time:'12:30',airport:'SHA'}, arrival:{time:'14:45',airport:'PEK'},
        durationMin:135, durationText:'2 小时 15 分', direct:true, onTimeRate:98,
        price:2620, originalPrice:2850,
        tags:['直飞','含托运23kg','可改签'],
        services:[{icon:'restaurant',label:'精致点心',available:true},{icon:'luggage',label:'23KG×2',available:true},{icon:'bolt',label:'快捷优先',available:true}],
        recommendation:'最稳妥', recommendationReason:'准点率 98% + 限制最少', badge:'最稳妥', badgeType:'safest',
        bookingUrl:'https://flights.ctrip.com/online/list/oneway-SHA-PEK?depdate=2026-04-15', source:'携程', updatedAt: new Date().toISOString()
      },
      {
        id:'flight_003', airline:'南方航空', flightNo:'CZ3116', aircraft:'空客 A330',
        departure:{time:'16:45',airport:'SHA'}, arrival:{time:'19:15',airport:'PEK'},
        durationMin:150, durationText:'2 小时 30 分', direct:true, onTimeRate:78,
        price:1850, originalPrice:2100,
        tags:['直飞','不含托运','不可退改'],
        services:[{icon:'no_meals',label:'不含餐食',available:false},{icon:'luggage',label:'仅10KG手提',available:true}],
        recommendation:'', recommendationReason:'', badge:'', badgeType:'',
        bookingUrl:'https://flight.qunar.com/site/oneway_list.htm?searchDepartureAirport=%E4%B8%8A%E6%B5%B7&searchArrivalAirport=%E5%8C%97%E4%BA%AC&searchDepartureTime=2026-04-15', source:'去哪儿', updatedAt: new Date().toISOString()
      }
    ]
  },
  detail: {
    updatedAt: new Date().toISOString(),
    flight: {
      id:'flight_001', airline:'中国东方航空', flightNo:'MU587', aircraft:'波音 777-300ER',
      departure:{time:'09:45',code:'PVG',airport:'上海浦东国际机场',terminal:'T2'},
      arrival:{time:'12:15',code:'JFK',airport:'纽约肯尼迪国际机场',terminal:'T4'},
      durationText:'12 小时 30 分', direct:true,
      price:8240, originalPrice:12480, cabin:'经济舱 (R)', seatsLeft:3,
      priceBreakdown:{base:7100,tax:1140,total:8240},
      rules:{
        baggage:{title:'行李额度',detail:'包含 23kg 托运行李 × 1 件\n及 7kg 手提行李 × 1 件',icon:'luggage'},
        refund:{title:'退改政策',detail:'起飞前不可改签\n退票手续费 ¥2,500 起',icon:'swap_horiz'},
        service:{title:'机上服务',detail:'提供两次正餐与点心\n全机位配备充电插座',icon:'airline_seat_recline_extra'}
      },
      priceTrend:[
        {height:70},{height:65},{height:60},{height:72},{height:68},{height:55},{height:50},
        {height:45},{height:35,isLowest:true},{height:48},{height:55},{height:62},
        {height:58},{height:65},{height:52,isToday:true}
      ],
      historicalLowest: 6800,
      similarRoutes:[
        {from:'PVG',to:'BOS',toCity:'波士顿',date:'4月12日',info:'转机 1 次 · 含行李',price:7450,imageUrl:'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=100&h=100&fit=crop',bookingUrl:'https://flights.ctrip.com/online/list/oneway-PVG-BOS'},
        {from:'PVG',to:'IAD',toCity:'华盛顿',date:'4月14日',info:'直飞 · 含行李',price:9120,imageUrl:'https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=100&h=100&fit=crop',bookingUrl:'https://flights.ctrip.com/online/list/oneway-PVG-IAD'},
        {from:'PVG',to:'LHR',toCity:'伦敦',date:'4月18日',info:'转机 1 次 · 不含酒水',price:5890,imageUrl:'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=100&h=100&fit=crop',bookingUrl:'https://flights.ctrip.com/online/list/oneway-PVG-LHR'}
      ],
      bookingUrl:'https://flights.ctrip.com/online/list/oneway-PVG-JFK?depdate=2026-04-15',
      source:'携程',
      bestPriceBadge:'最佳票价',
      updatedAt: new Date().toISOString()
    }
  },
  monitors: {
    updatedAt: new Date().toISOString(),
    monitors: [
      {id:'mon_001',from:{code:'SHA',city:'上海'},to:{code:'HND',city:'东京'},airline:'全日空航空 · 往返',targetPrice:2800,currentPrice:2450,status:'below_target',badge:'当前最低',trend:[60,75,55,80,65,45,35],lastUpdated:'2 分钟前',highlight:false,bookingUrl:'https://flights.ctrip.com/online/list/roundtrip-SHA-HND'},
      {id:'mon_002',from:{code:'PEK',city:'北京'},to:{code:'LHR',city:'伦敦'},airline:'英国航空 · 单程',targetPrice:4500,currentPrice:5120,status:'above_target',badge:'',trend:[50,60,55,58,62,60,58],lastUpdated:'1 小时前',highlight:false,bookingUrl:'https://flights.ctrip.com/online/list/oneway-PEK-LHR'},
      {id:'mon_003',from:{code:'CAN',city:'广州'},to:{code:'CDG',city:'巴黎'},airline:'全线航司监控中',targetPrice:3900,currentPrice:4050,status:'near_target',badge:'接近目标',trend:[],lastUpdated:'',highlight:true,bookingUrl:'https://flights.ctrip.com/online/list/oneway-CAN-CDG'}
    ],
    stats: { todayDeals: 8429, partners: 120 }
  }
};
