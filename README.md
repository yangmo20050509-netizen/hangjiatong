# 航价通 ✈️

> 聚合全网低价航班信息的发现平台，帮你省时省力，告别反复比价。

## 在线体验

部署后的地址：`https://fly.earfquake.online`

## 项目简介

**航价通**是一个纯前端的特价机票聚合展示平台，定位为**决策辅助工具**而非 OTA。

### 核心功能

- 🏠 **首页特价**：展示各平台精选低价航班，每张卡片包含推荐标签、规则限制、价格对比
- 🔍 **航线搜索**：按出发地/目的地/日期搜索，展示价格走势图 + 趋势结论
- 📋 **航班详情**：完整规则说明、价格构成、同类航线比价
- 📡 **价格监控**：设定目标价自动追踪（localStorage 存储）
- 🔗 **外跳购票**：所有 CTA 直跳对应 OTA 平台搜索页（携程/飞猪/去哪儿）

### 设计原则

1. **决策优先**：每个界面元素都服务于"帮用户更快做决定"
2. **规则前置**：致命限制（不可退改、不含托运）在卡片级别就暴露
3. **信任透明**：所有价格标注数据来源和更新时间
4. **中立立场**：CTA 文案为"去XX查看"而非"立即预订"

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript（单文件 SPA，无框架依赖）
- **数据**：当前为内嵌 Mock 数据，支持切换为远程 JSON 接口
- **部署**：GitHub Pages / EdgeOne / 任意静态托管

## 项目结构

```
flight-radar/
├── index.html          # 主应用（SPA，含所有页面和逻辑）
├── data/               # 数据目录（后续由爬虫/手动更新）
│   └── deals.json      # 特价航班数据
├── docs/               # 文档
│   ├── API_DOCS.md     # 后端接口契约
│   └── ARCHITECTURE.md # 架构说明
└── README.md
```

## 数据对接

项目预留了数据接口切换机制。打开 `index.html`，找到 `API_CONFIG`：

```javascript
const API_CONFIG = {
  USE_MOCK: true,           // 改为 false 启用远程数据
  BASE_URL: './data',       // 指向 JSON 文件目录
};
```

### 数据源规划

| 数据 | 当前状态 | 后续方案 |
|------|----------|----------|
| 首页特价 | Mock 数据 | 手动运营 + Kiwi API 国际线 |
| 搜索结果 | Mock 数据 | 预设热门航线 JSON |
| 外跳链接 | ✅ 已验证可用 | 携程/去哪儿 deeplink 模板 |

## 本地运行

直接双击 `index.html` 即可在浏览器中打开。

或者启动本地服务器：

```bash
npx http-server . -p 8080
```

## 部署到 GitHub Pages

```bash
# 1. 初始化 Git
git init
git add .
git commit -m "init: 航价通 v1.0"

# 2. 推送到 GitHub
git remote add origin https://github.com/你的用户名/hangjiatong.git
git branch -M main
git push -u origin main

# 3. 绑定自定义域名
#    仓库 Settings → Pages → Source 选 main 分支 → Save
#    Custom domain 填入 fly.earfquake.online
#    在你的域名 DNS 里加一条 CNAME 记录：fly → 你的用户名.github.io
```

## License

MIT
