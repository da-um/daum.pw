# daum12569 个人主页

极致单页个人主页。

- 技术栈：Vite + React + React Three Fiber + GSAP + Lenis。
- 风格：深色，以粒子和滚动动效为主。

文档：

- 视觉规范：`docs/design.md`
- 技术架构：`docs/architecture.md`
- 开发约束：`CLAUDE.md`

## 开发

```
npm install
npm run dev     # http://127.0.0.1:3000
npm run check   # 类型检查
npm run build   # 类型检查后构建到 .out/
```

## 改内容

所有内容都在 `src/data/` 下：

| 内容 | 文件 |
| --- | --- |
| 简介、联系方式、其余站点 | `site.ts` |
| 字标字形 | `brand-glyph.ts` |
| daumini 字形 | `daumini-glyph.ts` |

## 部署

主页由 **daum.pw** 提供：`dist/` 由 lemon 上的 Caddy 从本机目录直接读，构建产物写在 `.out/`（`vite.config.ts` 的 `build.outDir`）。

- `npm run build` 只构建到 `.out/`，不碰线上，也不写 `dist/`。
- `npm run deploy`（`scripts/deploy.mjs`）才会更新线上：
  1. 类型检查，带 `DAUM_ASSET_BASE` 构建到 `.out/`；
  2. 给 js、css、svg 生成 `.gz`（lu1 的 nginx 开了 `gzip_static`）；
  3. `rsync` 资源到 lu1 的 `qiqi-assets/releases/daum12569/assets/`；
  4. 逐个 `HEAD` 确认 lu1 上能访问，有一个不行就停，页面不换；
  5. 最后整体替换 `dist/index.html`，并换上 `dist/` 里的资源兜底、门禁页和图标。
- 部署依赖：`deploy.mjs` 需要能 `ssh lu1`（免密），本机要有 `rsync`。
- 不需要重启任何服务，Caddy 直接读目录，文件换掉就生效。
- `dist/` 带 `pwkey` cookie 门禁，没有这个 cookie 的请求一律走门禁页。
- 2026-10-27 域名对调后，主页在 daum.pw。
