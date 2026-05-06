# daum.pw

> 一个拒绝 `node_modules` 暴政的人写的个人主页。

## 技术栈（诚实版）

| 层级 | 技术 | 为什么 |
|------|------|--------|
| 前端框架 | **没有** | React 需要 50 行配置才能显示 Hello World，我的主页只有 249 行 HTML，它不配 |
| CSS 方案 | **没有** | Tailwind 要背 300 个类名，我直接写 CSS 变量，Autocomplete 都不需要 |
| 构建工具 | **没有** | `node server.js` 就是构建。构建产物？就是它自己 |
| 包管理器 | **没有** | `package.json` 里只有一个 `http`，Node.js 出厂自带 |
| 动画引擎 | **GSAP** | 唯一引进的第三方库。不是因为它好，是因为手写 ScrollTrigger 真的会秃 |
| 后端框架 | **没有** | Express 要 `npm install`，原生 `http` 模块开机即用，关机即走 |
| 数据库 | **JSON 文件** | 查询复杂度 O(1)：直接 `fs.readFileSync`。MongoDB 做得到吗？ |
| 管理后台 | **admin.html** | 一个文件搞定增删改查。WordPress？不认识 |
| CI/CD | **没有** | 保存即部署。鼠标拖进浏览器也是部署 |

## 本地运行

```bash
node server.js
```

端口 `3456`。没有 `.env`，没有 `npm install`，没有热重载。
改完代码按 F5，这叫热重载。

## 项目结构

```
.
├── index.html          # 门面
├── admin.html          # 后台，打开就能改数据，不用登录（因为懒得写登录）
├── server.js           # 后端，83 行，包含注释
├── css/style.css       # 样式，全手写，没有一行 !important（目前为止）
├── js/main.js          # 逻辑，全手写，console.log 已删除（大概）
├── data/               # 数据库（人类可读的 JSON）
│   ├── projects.json   # 项目列表
│   ├── timeline.json   # 特别感谢与收藏
│   └── signatures.json # 签名语录，随机显示一条，刷新可能看到更丧的
└── assets/             # 图片和视频，占仓库体积 99% 的元凶
```

## 常见问题

**Q: 为什么不用 TypeScript？**  
A: 因为类型约束不了我的人生。

**Q: 为什么不用 Vue / React / Svelte？**  
A: 这个网站的数据流是：JSON → innerHTML。不需要虚拟 DOM，因为没有 DOM  diff 的必要。

**Q: 性能优化做了什么？**  
A: 没有加任何分析工具，所以 Lighthouse 跑分是薛定谔的。只要不测，就是 100 分。

**Q: 如何贡献代码？**  
A: 不建议。AGPL-3.0 传染性很强，你改一个分号，理论上你的整个 GitHub 都要开源。

## 协议

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 开源。

> 注意：AGPL-3.0 为强 copyleft 许可证，任何基于本项目的修改或网络服务部署均须以相同许可证公开源代码。使用前请务必完整阅读许可证内容。
