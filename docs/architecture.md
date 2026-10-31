# 技术架构

## 技术栈

| 部分 | 用的是 | 说明 |
| --- | --- | --- |
| 构建 | Vite 8 | 单页，`index.html` 入口 |
| 界面 | React 19 + TypeScript 6（strict） | 只管 DOM 叠层和组件结构，每帧的数据不进 React state |
| 3D | three r186 + React Three Fiber 9 | 不用 drei，不用后期处理；材质全部自写 |
| 帧循环 | GSAP 3 的 `gsap.ticker` | 只用它的 ticker，不写 GSAP 动画 |
| 滚动 | Lenis | 平滑滚动，由 ticker 驱动 |
| 字体 | `@fontsource-variable/outfit` | 自托管 |

没有 Tailwind，没有路由，没有预渲染。运行时不从第三方域名加载资源：构建出的文件放在自己的 lu1 上（实时预览的两个站除外）。新增依赖要先说明理由。

开发依赖 `@types/node` 只用来给构建插件 `boot/plugin.ts` 和 `vite.config.ts` 做类型检查（`tsconfig.node.json`）。

## 目录

```
site/
├─ index.html                 入口，noindex
├─ vite.config.ts             构建配置；DAUM_ASSET_BASE 决定文件从哪里加载
├─ tsconfig.node.json         给 vite.config.ts 和 boot/plugin.ts 做类型检查
├─ boot/                      加载画面，构建时写进 index.html
│  ├─ plugin.ts               Vite 插件：生成字标 SVG、内联样式和脚本、文件清单
│  ├─ boot.css                加载画面样式
│  └─ boot.js                 下载并计数、启动应用、交接
├─ scripts/deploy.mjs         发布：lu1 放文件，dist/ 放页面
├─ public/
│  ├─ favicon.svg             圆角方块，只有字标表面的渐变（用户 2026-10-21 要求，去掉了 d）
│  └─ gate/index.html         预览门禁页，独立页面，样式内联
├─ src/
│  ├─ main.tsx                挂载 App，引入字体和全局样式
│  ├─ App.tsx                 能力检测，选 3D 或静态版；Lenis、滚动进度、鼠标
│  ├─ data/
│  │  ├─ site.ts              作品、邮箱、联系方式、9 个国家（页面上的全部内容）
│  │  └─ brand-glyph.ts       字标 daum12569 的 Outfit 800 轮廓（已合并重叠路径）
│  ├─ lib/
│  │  ├─ palette.ts           颜色：底色、字标表面 FACE / face()、投影 shade()
│  │  ├─ mark.ts              开场字标的尺寸、层数、取景、飞入、镜头视角，场景和加载画面共用
│  │  ├─ timeline.ts          整页时间轴 T 和缓动函数
│  │  ├─ frame-store.ts       每帧变化的值，以及场景要摆放的 DOM 节点
│  │  ├─ capabilities.ts      WebGL2、减少动态效果等检测
│  │  └─ random.ts            带种子的随机数，保证每次布局一样
│  ├─ scene/                  3D 场景（懒加载，单独一个包）
│  │  ├─ Stage.tsx            Canvas、帧驱动、按宽高比生成 world
│  │  ├─ world.ts             所有位置和镜头路线，按宽高比现算
│  │  ├─ rail.ts              镜头路线：一站站的位置和看向的点，按进度平滑走
│  │  ├─ Rig.tsx              镜头：沿路线走，加鼠标视差
│  │  ├─ Wordmark.tsx         开场字标：14 层剪影
│  │  ├─ glyphs.ts            把字标拆成 9 个字，算每个字的穿越点和基线
│  │  ├─ Plates.tsx           页面底板、9 张镂空卡片、分层切口、结尾叠成一摞
│  │  ├─ Fragments.tsx        隧道里的碎片
│  │  ├─ StarMap.tsx          qiqi.help 星图、国家名定位、qiqi.help 实时页面的位置
│  │  ├─ Daumini.tsx          daumini 的白板、手绘框、实时页面整页淡入
│  │  ├─ live.ts              把 DOM 元素按透视贴到 3D 矩形上
│  │  └─ materials.ts         扁平材质：底板、纯色/渐变、实例色
│  ├─ sections/
│  │  ├─ Overlay.tsx          3D 之下的 daumini 实时页面；3D 之上的首屏细线、进度条、国家名、标题、qiqi.help 实时页面、结尾
│  │  └─ Flat.tsx             静态版（无 WebGL2 或减少动态效果）
│  ├─ styles/global.css       颜色 token 和全部样式
│  └─ assets/work/            两张作品截图，只给静态版用
├─ docs/                      本文档和视觉规范
├─ .out/                      构建输出（npm run build），不对外
├─ dist/                      daum.pw 的主页目录，Caddy 直接读；只由 npm run deploy 写入
└─ .tools/devshot/            在站长电脑上截图的工具，见“验证”
```

## 页面怎么跑起来

0. 先出加载画面（见下一节）。它下完文件后才启动应用。
1. `App` 检测能力。WebGL2 可用并且没开“减少动态效果”时走 3D，否则只渲染 `Flat`。
2. 3D 模式下，页面是一个 1100vh 高的空占位块加两层固定定位的东西：底下是 Canvas（`Stage`，懒加载），上面是 DOM 叠层（`Overlay`）。
3. `Stage` 第一次画出场景后，给 `<html>` 加上 `gl` 类，叠层才显示，并发出 `daum:ready`。静态版挂载后也发 `daum:ready`。
4. 加载画面收到 `daum:ready` 后淡出，发出 `daum:enter`，Lenis 这时才开始接收滚动。

## 加载画面

- **写进 HTML**：`boot/plugin.ts` 在构建时把加载画面直接写进 `index.html`，不等任何脚本就能显示：
  - 字标 SVG：14 个 `<use>`，颜色来自 `lib/palette.ts`；
  - 内联的 `boot.css`，宽度按 `MARK_FIT` 换算成 `vw`/`vh`，和 3D 镜头的取景一致；
  - 内联的 `boot.js`、一份文件清单 `window.__BOOT`、字标的排布参数 `window.__MARK`（层数、步长、方向、开场飞入、镜头视角，都来自 `lib/mark.ts`）。
- **文件清单**：构建时插件去掉页面里原有的 script、modulepreload、stylesheet 标签，改成一份清单：入口包和它依赖的包、3D 包（标为只在 3D 下需要）、CSS、Outfit 拉丁子集，每个带字节数。
- **开场**：`boot.js` 每帧按 `MARK_INTRO` 算出每层的位置、旋转、透明度，并按 3D 镜头的透视（开场镜头距离和 `world.ts` 的 `heroDist` 同一个公式）换算成 SVG 变换。动画时钟按真实时间走，但不超过下载进度允许的位置，所以缓存命中时是完整的 1.8 秒，网慢时各层随下载往里飞。
- **下载**：用 `fetch` 流式下载清单里的文件并计数。全部下完后插入 CSS，再 `import()` 入口；这时文件都在 HTTP 缓存里，不会重复下载。3D 包只在 WebGL2 可用且没开“减少动态效果”时下载（和 `lib/capabilities.ts` 的判断一致）。
- **交接**：正面落定并且收到 `daum:ready` 后，加载画面淡出 0.35 秒，去掉 `<html>` 的 `boot` 类（解除滚动锁定），发出 `daum:enter`。3D 字标从静止的完整状态开始，开场镜头正对字标，所以两边画面重合。
- **兜底**：从 lu1 加载失败就整套改从本机 `/` 再来一次；45 秒后无论如何都放行。
- 包里引用的字体和图片都是相对路径（`vite.config.ts` 的 `renderBuiltUrl`），所以 lu1 和本机两份各自完整。
- 开发服务器里没有清单：`boot.js` 只等 `daum:ready`，飞入先走到九成。

## 帧循环

- 全站只有一个循环：`gsap.ticker`，关掉了 lagSmoothing。
- 每一帧依次做：
  1. Lenis 往前走一帧，算出滚动进度 `frame.progress`（0 到 1），`Overlay.update(p)` 更新文字淡入淡出、进度条和实时页面的加载。
  2. `Stage` 里的 Driver 算出 `frame.time`（场景首次渲染后的秒数），调用 R3F 的 `advance(秒)`。Canvas 是 `frameloop="never"`，只在这里渲染一次。
  3. 各组件的 `useFrame` 只读 `frame.progress`、`frame.time` 和 `frame.pointer`，自己算出当前样子。
- 每帧变化的值都放在 `lib/frame-store.ts` 的 `frame` 对象里，不经过 React state。

## 时间轴和世界

- `lib/timeline.ts` 的 `T` 定义每一段的进度区间：open、dive、ease、stars、gather、pass、draw、fill、end、back、out、tint、line。
- 各组件用 `span(p, T.xxx)` 取段内的 0–1，再套缓动。画面只取决于进度，倒着滚也一样。
- `scene/world.ts` 的 `makeWorld(aspect)` 一次算出：
  - 开场镜头距离；
  - 9 张卡片的位置（让每个字最粗的笔画落在螺旋线上，前后间距让下一个字能完整进画面）；
  - 星图和 qiqi.help 页面的位置；
  - daumini 页面（白板上）和阅读位置；
  - 镜头路线 `way`：`on` 从开场经隧道、星图、qiqi.help 页面到 daumini，`back` 沿原路倒退出隧道再拉远到叠好的名字前；
  - 结尾叠成一摞的位置（每张卡片的大小随字，见 `cardOf`）。
- 镜头路线（`scene/rail.ts` 的 `Rail`）：
  - 由一站站组成，每站有镜头位置和看向的点，两者各连成一条 Catmull-Rom 曲线，同一站在两条曲线上对齐。
  - 哪个进度到哪一站写在 `world.ts` 里，引用 `T` 的区间。站与站之间按“走过的距离”用单调三次插值过渡：速度连续变化，不倒退，不冲过站，首尾从静止起停。
  - 改路线后，用逐点采样检查：每 0.05% 进度的转角、相邻两步的速度变化、穿过每张卡片的进度（采样脚本不在仓库里，按需临时写）。
- 宽高比小于 1 时整套换成竖屏构图。窗口尺寸变了就重新算。
- 开发时 `?p=0.4` 把进度钉在 0.4（只在 dev 下生效）。

## 渲染

- Canvas 设成 `flat linear`：不做色调映射，不做颜色空间转换。材质里的颜色是原样的 sRGB 数值，画出来和 CSS 一模一样。
- Canvas 是透明的，背后的 CSS 底色透上来。3D 里的底板用和 CSS 相同的 135° 公式在屏幕空间算渐变，看不出接缝。
- 材质（`scene/materials.ts`）全是不带光照的 ShaderMaterial：
  - `plateMaterial`：底板色，带圆角矩形开孔，可以整体染成横跨名字的渐变（结尾卡片）。
  - `flatMaterial`：纯色，或横向渐变（字标正面、切口）。
  - `instanceMaterial`：每个实例一个颜色（碎片、星点）。
  - daumini 一段有自己的三种材质（`Daumini.tsx`）：白板（点阵，按世界坐标画，太小时淡掉）、墨线（按 `aT` 逐段画出来）。两者都带 `uSketch`，为 0 时按屏幕空间公式变回 CSS 底色。daumini 字标是小赖字体 `daumını` 的轮廓（`data/daumini-glyph.ts`，用 daumini 仓库里的 fonteditor-core 从它的字体文件导出），不加载字体。
- 大量重复的东西用 InstancedMesh：碎片 240 个、星点 121 个。
- 手动创建的几何体和材质在组件卸载时 `dispose()`。

## 叠层和实时页面

- `Overlay` 里的 DOM 有两种：
  - 按进度淡入淡出的：两个标题、结尾，由 `update(p)` 控制；
  - 由场景每帧摆位置的：国家名、两个实时页面，节点放在 `frame.dom` 里。
- 叠层从下到上：CSS 页面底色、`.under`（daumini 的实时页面）、`.stage`（透明画布，不接收鼠标）、`.overlay`。
- 实时页面是 `.live` 里面套一个 1280×800 的 iframe：
  - **贴位**：场景每帧把目标矩形的四个角投影到屏幕上，`scene/live.ts` 的 `pin()` 算出一个 `matrix3d` 透视变换，让 iframe 正好盖在那个矩形上。有角跑到镜头后面就隐藏。正对镜头时（第四个角和平行四边形的推算差不到 1px）改用整像素的 2D `matrix()`，浏览器按显示大小重画，字才清楚；读页面的两段 `Rig` 把鼠标视差收到 0，保证正对。
  - **加载**：进度进入范围时设置 `src`，离开范围 0.05 后改成 `about:blank` 释放（范围见视觉规范）。iframe 加载完成前，下面的 3D 占位面先顶着。
  - **qiqi.help**：地址带 `?embed=daum12569`，它（qiqi.help `src/lib/embed.ts`）会停在星图、直接就位，用 postMessage 把星星和国名的位置发给 https://daum.pw（2026-10-27 域名对调后更新）；主页在 `lib/qiqi.ts` 收下放进 `frame.qiqi`（iframe 从 0.05 就加载，星星出来前每秒问一次），星星出来时定下画哪张图（`StarMap.tsx` 的 `sharedMap`：它的星、环、连线放在一个 Group 里，坐标就是它窗里的像素，整组从铺满画面缩放平移到页面里星图框的位置）。在 `.overlay` 里，外层是 `div.live.use`，iframe 接收鼠标、滚轮和键盘（淡入过半、且镜头还没开始往里飞时才接收，`show()` 的 `take`），sandbox 另开了表单和弹窗。
  - **daumini**：在 `.under` 里，外层是 `<a class="live sketch">`，iframe 不接收鼠标，点击打开原站。白板是不透明材质，在页面那块写出 `vec4(c * a, a)`（不透明材质不混合，画布是预乘 alpha，所以这块按 a 叠在下面的页面上），a 从 1 降到 0，页面整页透出来；手绘框在白板前面，照常按深度画。
- qiqi.help 的页面在镜头飞进去、铺满屏幕后淡出，露出星图底板上已经打开的窗口。窗后就是 daumini 的白板，daumini 的页面在镜头到站时整页淡入。

## 降级

- `lib/capabilities.ts` 检测 WebGL2、减少动态效果、粗指针、低端设备。目前只用到前两项，`coarsePointer` 和 `lowEnd` 检测了但没有地方用。
- 鼠标监听只认 `pointerType === 'mouse'`，触屏不触发视差。
- 设备像素比上限 2。

## 性能

当前构建（gzip 后）：

| 文件 | 大小 | 内容 |
| --- | --- | --- |
| `index.html` | 约 5 KB | 加载画面（字标 SVG、样式、脚本、文件清单） |
| 首屏 `index-*.js` | 约 107 KB | React、GSAP、Lenis、叠层、字标轮廓 |
| 3D `Stage-*.js` | 约 258 KB | three、R3F、场景 |
| 字体 | 47 KB | Outfit 两个子集，加载画面只预先下载拉丁子集（32 KB） |
| 截图 | 95 KB | 只有静态版用 |

加载画面等的是前四行（字体只算拉丁子集），约 400 KB。

两个实时页面会各加载一整个站，所以只在附近时加载。

## 构建和部署

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器，`127.0.0.1:3000`。3000 被占用时用 `npx vite --host 127.0.0.1 --port 3007`，通过 `ssh -L` 隧道访问 |
| `npm run check` | 类型检查（`src/`，以及 `tsconfig.node.json` 里的构建配置） |
| `npm run build` | 类型检查后构建到 `.out/`，不影响预览站 |
| `npm run deploy` | 发布到预览站，见下 |

- **发布**（`scripts/deploy.mjs`）：
  1. 类型检查，带 `DAUM_ASSET_BASE=https://8.137.206.169/assets/daum12569/` 构建到 `.out/`。
  2. 给 js、css、svg 生成 `.gz`（lu1 的 nginx 开了 `gzip_static`）。
  3. `rsync` 到 lu1 的 `/home/user1/apps/qiqi-assets/releases/daum12569/assets/`，就是 qiqi.help 数据目录旁边。目录 755、文件 644。
  4. 逐个 `HEAD` 检查 lu1 上能访问到，有一个不行就停，页面不换。
  5. 把文件也复制一份到 `dist/assets/`（兜底用），复制门禁页和图标，最后整体替换 `dist/index.html`。
- **lu1**：nginx 给 `/assets/` 加了跨域头 `*` 和一年的 immutable 缓存。文件名都带内容哈希，旧文件不删，已经打开的页面还能取到。lu1 上的文件不经过门禁，知道地址就能下载。qiqi.help 的发布不会清理别的目录。
- **主页**：由 `daum.pw` 提供，`dist/` 由 lemon 上的 Caddy 从本机目录直接读（2026-10-27 域名对调后更新）。
  - 带 `noindex` 和 `no-store` 头。
  - 没有正确 `pwkey` cookie 的请求，一律改写到 `/gate/`。门禁页里输入密钥，写入 cookie 后刷新。
  - 门禁规则里放行的路径是 `/_astro/*` 和 `/favicon.svg`。`/_astro/*` 是 Astro 时期留下的，现在的资源在 `/assets/`，不影响使用。
- 2026-10-27 域名对调后已正式切到 `daum.pw`。

## 验证

- 每次改完跑 `npm run check`。
- lemon 性能弱，用软件渲染 WebGL 又慢又不准。要看画面，交给站长电脑上的渲染站（qiqi.help 那套，见 `/www/daum/qiqi.help/promo/README.md` 的“在站长电脑上渲染”）：

  ```sh
  npx vite build --outDir .tools/devshot/site --emptyOutDir   # 测试用构建，文件从本机加载，不碰 dist/
  node .tools/devshot/ask.mjs 0,0.53,0.985                     # 按滚动进度出图（1440×900）
  node .tools/devshot/ask.mjs 0.53,0.985 --size 390x844        # 换个视口
  node .tools/devshot/ask.mjs 0 --boot                         # 另外拍两张加载画面，并报告滚动是否解锁
  node .tools/devshot/ask.mjs --url https://daum.pw/           # 截别的网址
  ```

  - 图片落在 `.tools/devshot/out/<时间>/`。
  - 原理：把测试构建和 `render.mjs` 作为一次 render 任务发给渲染站，它在本机起一个静态服务，用显卡跑 Chrome 截图，再传回来。
  - 渲染站没开时会直接报错，这时问站长。
- 只看改动的地方，不反复截图。
