# daum.pw

一个懒得用框架的人写的个人主页。

## 技术栈（真的）

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端框架 | 无 | 引入 React 要写 50 行配置，我的主页只有 249 行 HTML |
| 样式方案 | 无 | Tailwind 要背类名，我写 CSS 变量更快 |
| 构建工具 | 无 | `node server.js` 就是构建，构建结果就是它自己 |
| 动画引擎 | GSAP | 唯一一个引进的第三方库，因为手写滚动动画会掉头发 |
| 后端框架 | 无 | Express 要 `npm install`，原生 `http` 模块开机即用 |
| 数据库 | JSON 文件 | 没有比 `fs.readFileSync` 更快的数据库了 |
| 管理后台 | admin.html | 一个文件搞定增删改查，比安装 WordPress 快十倍 |

## 本地运行

```bash
node server.js
```

端口 `3456`。没有 `.env` 要配，没有依赖要装，没有热重载要开。

## 项目结构

```
.
├── index.html          # 主页
├── admin.html          # 后台（打开就能用）
├── server.js           # 后端（就一个文件）
├── css/style.css       # 样式（全部手写）
├── js/main.js          # 逻辑（全部手写）
├── data/               # 数据库（JSON 文件）
│   ├── projects.json
│   ├── timeline.json
│   └── signatures.json
└── assets/             # 图片视频
```

## 协议

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 开源。

> 注意：AGPL-3.0 为强 copyleft 许可证，任何基于本项目的修改或网络服务部署均须以相同许可证公开源代码。使用前请务必完整阅读许可证内容。
