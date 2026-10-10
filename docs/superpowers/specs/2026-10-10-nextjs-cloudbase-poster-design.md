# 子项目 A：Next.js 迁移、换装页与假海报 设计

日期：2026-10-10
状态：已与用户逐段确认，待用户审阅本文
上游文档：`2026-10-08-threejs-avatar-dressup-design.md`（three.js 换装核心设计，本文只写变化的部分，3D 规则沿用原文第 7 节）
界面稿：Design 画板 https://claude.ai/artifact/NEXyehYxcBFtxvnzD6PZ4i （两块画板：设计系统、换装台主页面）

## 1. 背景与总体方向

原项目是 Vite 加 Vue 3 的纯前端换装页，3D 层、数据层、规则层、资源脚本和测试已完成，页面组件尚未动笔。用户决定把产品做成多用户应用：账号登录、保存 3D 形象、保存时用 AI 把形象渲染成海报当封面、在「我的形象」看历史封面并点进去继续编辑。

已定的决策：

| 决策 | 结论 |
|---|---|
| 框架 | 换成 Next.js 16 App Router 加 React 19，原仓库原地迁移，git 历史保留 |
| AI 的角色 | 只做「AI 渲染海报」，不做贴图生成 |
| AI 服务 | 第一版只做假的演示适配器，真实服务以后接 |
| 后端 | 腾讯云云开发 CloudBase 个人版，首年 99 元；Next.js 跑在云托管，数据用文档型数据库，图片用云存储，登录用云开发身份认证 |
| 观众 | 内地为主 |
| 美术方向 | 方向 A「暗色角色工坊」，参照 hyper3d.ai 的骨架，字体偏科技感 |

整个产品拆成三个子项目，各走一遍设计到实施：

| 子项目 | 内容 | 依赖 |
|---|---|---|
| A（本文） | Next.js 重建换装页，3D 层照搬，海报接口接假适配器，部署到云托管，无账号 | 现有代码 |
| B | 登录、保存形象、保存时生成封面、我的形象列表、点进去编辑再保存 | A |
| C | 接真实图生图服务、限流与成本保护、封面异步生成、备案域名 | B |

B 和 C 各自另写设计文档。本文只在第 10 节写出 A 必须为它们预留的接口。

## 2. 目标与非目标

目标：

- 打开站点先看到首页介绍页：一句话说清产品、一个「开始创建」入口、三个能力区块、三步流程。结构参照 hyper3d.ai 的首页骨架，视觉按本文第 4 节的设计系统。
- 点「开始创建」进入 `/create` 换装页，能按七个槽位换装、一键套装、切换底模、播放待机动画、聚焦头部或全身。
- 换装页顶栏「生成海报」：截图后由服务端假适配器做风格化，弹窗展示并可下载。
- 部署在云托管默认域名上可访问，模型贴图随站点一起提供。
- 设计系统落地为全局令牌，界面与画板一致。

非目标（A 不做）：

- 账号、保存、恢复、我的形象、历史海报（B）。
- 真实 AI 服务、限流、成本保护、备案域名（C）。
- 贴图变体：免费素材没有色变体，运行时逻辑整段删除。
- 底模身体隐藏：底模头身是一整块网格，规则无法成立，删除。衣服直接套在底模外面。
- 多套主题切换：只留暗色一套。
- 移动端适配：面板在窄屏下堆叠到视口下方，不做进一步适配。

## 3. 技术选型

| 项 | 选择 | 版本（2026-10-10 核对） |
|---|---|---|
| 框架 | Next.js App Router，TypeScript 严格模式 | next 16.4、react 19.3 |
| 状态 | zustand | 5.0 |
| 3D | three 加 @types/three | 0.186 |
| 服务端图片处理 | sharp | 0.35 |
| 资源脚本 | @gltf-transform/core、functions、extensions，fast-glob | 沿用 |
| 测试 | vitest | 5.0 |
| 部署 | 腾讯云云托管，@cloudbase/cli | latest |
| 本机 | Node 22.14 | 满足 Next 要求 |

去掉的依赖：vue、@vitejs/plugin-vue、vue-tsc、vite、idb-keyval（缩略图缓存只留内存，见 6.2；saves.ts 只保留纯函数，见 6.1）。

## 4. 设计系统

来自画板，写进 `app/globals.css` 的 `:root` 令牌。单主题暗色，不做亮色。

色板：

| 令牌 | 值 | 用途 |
|---|---|---|
| --ground | #0F0E14 | 页面底色，紫调近黑 |
| --panel | #13121A | 右侧面板 |
| --card | #1B1A23 | 卡片、芯片 |
| --line | #2A2834 | 描边 |
| --line-hover | #3A3846 | 悬停描边 |
| --text | #EFEDF3 | 正文 |
| --muted | #A09DAE | 次要文字，对比 6.8:1 |
| --accent | #E8A445 | 余烬金，唯一主色：主按钮、选中态、当前 tab |
| --on-accent | #1A1206 | 金上文字，对比 8.8:1 |
| --ai | #AE98F2 | 薰衣草，只用于 AI 相关标记与焦点环 |
| --ok / --warn / --error | #6FCF97 / #F2C94C / #EB7A7A | 语义色 |

字体：

| 角色 | 字体 | 加载方式 |
|---|---|---|
| 字标、英文眉题、编号 | Orbitron 600/700 | next/font/local，woff2 进仓库 |
| 中文大标题（页面标题 38、区块标题 19） | 站酷庆科黄油体 | next/font/local，woff2 进仓库，约 1 到 2 MB |
| 正文与控件 | 系统中文黑体栈：PingFang SC、Microsoft YaHei、Noto Sans CJK SC、sans-serif | 不加载 |

不用 Google Fonts 运行时链接：观众在内地，fonts.googleapis.com 不可达。两款字体都是 OFL 许可，自托管合规。

布局与控件：顶栏 64，视口自适应，面板 480 固定宽，窄于 1000 时面板堆到视口下方。按钮胶囊形高 40，卡片圆角 14，芯片圆角 999，焦点环用 --ai 色 2px。控件状态与画板「设计系统」一致：部件卡四态（已装、可选、加载中、不可用）。

## 5. 目录结构

```
avatar-dressup/
  app/
    layout.tsx             全局壳：字体、令牌、lang="zh-CN"
    page.tsx               首页介绍页，服务端组件，不加载 three 与模型
    create/page.tsx        换装页，只挂 DressUp
    globals.css            设计系统令牌与基础样式
    api/poster/route.ts    POST /api/poster
  components/
    landing/SiteNav.tsx    首页顶栏：字标、GitHub 链接、开始创建
    landing/Hero.tsx       首屏：标题、一句话、开始创建、三张海报示意
    landing/Features.tsx   三个能力卡
    landing/Steps.tsx      三步流程
    landing/SiteFooter.tsx 页脚：GitHub、素材致谢
    DressUp.tsx            页面主体，创建 store、viewer、viewerSync
    Viewport.tsx           客户端组件，useEffect 建 AvatarViewer，底部芯片与截图按钮
    TopBar.tsx             字标、生成海报按钮
    PartsPanel.tsx         套装卡、部位 tab、部件网格、底部摘要
    PartCard.tsx           缩略图与四态
    PosterDialog.tsx       风格选择、生成中、结果与下载、错误
  src/
    avatar/                AvatarRig、AvatarViewer、PartLoader、rebind、slotRules、ThumbnailRenderer
    data/manifest.ts       校验
    data/assetUrl.ts       读 NEXT_PUBLIC_ASSET_BASE
    data/saves.ts          只留 toSaveRecord、fromSaveRecord 两个纯函数，保留给 B
    state/avatarStore.ts   zustand store
    state/viewerSync.ts    store.subscribe 版
    poster/types.ts        PosterProvider 接口与风格枚举
    poster/mock.ts         sharp 假适配器
    poster/index.ts        按环境变量选适配器
    types/manifest.ts      去掉 bodyMeshes、headMeshes
  scripts/                 build-manifest.mjs、lib/classify.mjs、manifest.config.mjs
  public/avatar/           脚本输出，进 git
  public/landing/          首页用的三张假海报与一张换装页截图，WebP
  app/fonts/               两款自托管字体的 woff2，由 next/font/local 引用
  tests/
  Dockerfile  next.config.ts  .env.example  .npmrc
```

删除：index.html、vite.config.ts、src/main.ts、src/App.vue、src/env.d.ts、src/styles/。

## 6. 各层变化

### 6.1 类型与 manifest

- `BaseModel` 去掉 `bodyMeshes`、`headMeshes`。校验同步去掉。
- `Part.variants` 保留为 `Variant[]`，脚本始终写空数组，运行时不读。
- `SaveRecord` 去掉 `variants`。`saves.ts` 删除 `listSaves`、`addSave`、`deleteSave` 和 idb-keyval，只留 `toSaveRecord`、`fromSaveRecord`，后者不再处理变体。
- 其余不变。

### 6.2 3D 层

- `AvatarRig`：删除 `setVariant`、`setBodyVisible`、`bodyMeshes`、`originalMaps`、`variantTexture`、`variantRequest` 及相关释放代码。`equip` 仍克隆材质，因为缩略图渲染器和主视口共用加载器缓存。
- `AvatarViewer`：删除 `setVariant`、`setBodyVisible`、`applyBackgroundFromCss`，背景色固定读令牌 --ground 的值（构造时传入）。
- `rebind.ts`、`PartLoader.ts`、`slotRules.ts`：去掉变体相关函数 `setVariant` 与状态里的 `variants` 字段；`AvatarState` 变为 `{ baseId, equipped }`。
- `ThumbnailRenderer`：去掉 idb-keyval，缓存只在内存；页面刷新后重新渲染，128 像素一张约 20 毫秒，可接受。

### 6.3 状态层

```ts
interface AvatarStore {
  avatar: AvatarState            // { baseId, equipped: Record<slotId, partId[]> }
  activeSlot: string
  equip(part: Part): void
  unequip(slotId: string, partId?: string): void
  toggle(part: Part): void
  applyPreset(preset: Preset): void
  setBase(base: BaseModel): Part[]   // 返回被卸下的部件，供提示
  reset(): void
  replace(next: AvatarState): void   // 给 B 的恢复用
  setActiveSlot(id: string): void
}
```

`createAvatarStore(manifest)` 返回 zustand 的 vanilla store，React 侧用 `useStore(store, selector)` 订阅。派生值（当前底模、有部件的槽位、当前槽位的部件、已装 id 集合）是接收 store 状态的纯函数，放在 `avatarStore.ts` 导出，组件里用 `useStore` 加 selector 取。

### 6.4 同步层

`createViewerSync(store, viewer, manifest, onError)`：

- 用 `store.subscribe((s, prev) => ...)`，仅当 `s.avatar !== prev.avatar` 时入队。创建时立即对当前状态 apply 一次。
- 差分、串行队列、失败回滚（装备失败调 `store.getState().unequip`）与现在完全一致，删去变体分支和 `setBodyVisible` 调用。
- `idle()` 保留给测试。

### 6.5 组件层

- `DressUp`：客户端组件。挂载时 `loadManifest()`，成功后建 store、viewer、viewerSync、ThumbnailRenderer；manifest 失败或 WebGL 不可用时整页显示错误与原因。卸载时 `sync.stop()`、`viewer.dispose()`、`thumbs.dispose()`。
- `Viewport`：容器 div 交给 `AvatarViewer`。底部芯片：底模下拉（切换后用 `setBase` 返回值弹一条「已卸下 N 件不匹配部件」提示）、全身或头部分段、动画名只显示。右下截图按钮下载当前视图。
- `PartsPanel`：顶部两张套装卡（来自 manifest.presets），当前套装高亮；部位 tab 顺序与 `slots` 一致，没有部件的槽位不显示；网格三列，单选槽位第一格固定「无」；底部摘要「已装 N 件 · 套装名 · 底模名」加重置。
- `PartCard`：缩略图未就绪显示名称；加载中显示转圈；失败置灰并带 title 提示。
- `TopBar`：字标链接回首页、「生成海报」主按钮。B 之前不显示「我的形象」与账号。

### 6.6 海报

接口契约：

```
POST /api/poster
Content-Type: application/json
{ "image": "data:image/jpeg;base64,...", "style": "fantasy" | "anime" | "watercolor" | "cyberpunk" }

200  Content-Type: image/jpeg  二进制
400  { "error": "图片必须是 JPEG data URL" | "图片超过 4 MB" | "未知风格" }
500  { "error": "海报服务未配置: POSTER_PROVIDER=xxx" | 适配器错误信息 }
```

前端：截图 768 乘 1152、质量 0.85；请求体约 200 KB。结果用 `URL.createObjectURL` 显示，下载用 `<a download>`，文件名 `avatar-poster-<风格>-<时间>.jpg`。弹窗状态机：选风格 → 生成中 → 结果 | 错误。风格记在 localStorage。

适配器：

```ts
export type PosterStyle = 'fantasy' | 'anime' | 'watercolor' | 'cyberpunk'
export interface PosterProvider {
  readonly id: string
  generate(input: { image: Buffer; style: PosterStyle }): Promise<Buffer>
}
```

`poster/index.ts` 读 `process.env.POSTER_PROVIDER`，`mock` 返回假适配器，其他值抛错。假适配器用 sharp：缩放到 768 乘 1152，按风格调 hue、saturation、brightness 与 tint，轻微色调分离，底部合成一条 SVG 标题栏写风格名与日期，输出 JPEG 质量 0.85。四套参数写在 `mock.ts` 顶部的表里。

### 6.7 资源脚本

- 扫描范围收窄：底模只扫 `base/**/Base Characters/**`，发型眉毛只扫 `base/**/Rigged to Head Bone/**`，服装只扫 `outfits/**/Modular Parts/**`，动画扫 `anim/**`。排除 Origin at 0、Outfits 整套、FBX 目录。
- `--optimize` 固定开启：dedup、prune、resample，加贴图缩到 1024（gltf-transform 的 textureCompress，编码器用 sharp）。
- 动画只保留选中的 idle 剪辑，其余剪辑删除后 prune，7.6 MB 降到几百 KB。
- 不再写 bodyMeshes、headMeshes。
- 输出进 git：`.gitignore` 去掉 `public/avatar/models/`、`textures/`、`anim/`，预计 20 到 40 MB。

### 6.8 首页

路由 `/`，服务端组件，静态渲染，不引入 three、store 和模型。目标是打开即显示、首屏体积小于 1 MB。自上而下四段，结构参照 hyper3d.ai 首页的骨架，文案与视觉是自己的：

1. **顶栏。** 字标（链接 `/`）、GitHub 仓库链接、「开始创建」胶囊主按钮（链接 `/create`）。
2. **首屏。** 左侧大标题两行，站酷庆科黄油体，例如「创建你的 3D 形象 / 换装，再让 AI 画成海报」；一句话副标；「开始创建」主按钮。右侧三张假海报卡片错落叠放，带轻微浮动动画，`prefers-reduced-motion` 时静止。海报图来自 A3 阶段用假适配器生成的真实截图，导出 WebP 放 `public/landing/`。背景用 --ground 加一处径向辉光，不用整屏渐变。
3. **三个能力卡。** 换装：七个部位、两套服装、两个底模；动画与视角：待机动画、头部与全身聚焦、一键截图；AI 海报：四种风格、一键生成、直接下载。每卡一张小图或图标，不写数字统计。
4. **三步流程。** 选底模 → 换衣服 → 生成海报，每步一句话。末尾再放一次「开始创建」。
5. **页脚。** GitHub 链接、素材来源「Quaternius，CC0」致谢、年份。

不放的东西：价格、用户数、评价、登录入口（B 再加）。标题与副标文案在实施时定稿，本文只定结构。

## 7. 部署

- `next.config.ts`：`output: 'standalone'`。
- Dockerfile 按云开发官方三阶段：deps、builder、runner，基础镜像 node:20-alpine，runner 设 `NODE_ENV=production`、`HOSTNAME=0.0.0.0`、`PORT=3000`，COPY `public`、`.next/standalone`、`.next/static`，非 root 用户运行，`CMD ["node","server.js"]`。
- `.npmrc` 指向国内镜像，云端构建拉 sharp 预编译包时用。
- 部署命令：`tcb login` 后 `tcb cloudrun deploy --port 3000`。
- 服务规格：0.25 核 0.5 GB，高可用模式最小副本 1，不缩容到零。内存不够时升 0.5 核 1 GB，每月约多 3 元。
- 环境变量：`POSTER_PROVIDER=mock` 在云托管服务设置里配；`NEXT_PUBLIC_ASSET_BASE` 默认 `/avatar/`，构建期生效。
- 域名：默认域名 `*.ap-shanghai.app.tcloudbase.com`。
- 资源点估算：实例常驻约 21,000 点每月，流量 800 点每 GB，一千次访问约 8,000 点，个人版 40,000 点每月够用。

## 8. 错误处理

| 场景 | 表现 |
|---|---|
| manifest 校验失败、底模加载失败 | 整页错误，显示原因 |
| WebGL 不可用 | 整页提示 |
| 部件加载或绑定失败 | 该卡置灰带提示，状态回滚，其余不受影响 |
| 海报请求 400/500 或网络失败 | 弹窗内显示原因，可重试 |
| 适配器未配置 | 500，前端显示「海报服务未配置」 |

## 9. 测试

单元测试（vitest，不碰 WebGL）：

- 沿用：slotRules、manifest、classify、rebind、avatarRig、viewerSync（改成 store 版）；saves 只保留序列化往返与缺失部件跳过的用例。
- 新增：`avatarStore.test.ts` 覆盖动作与派生值；`poster.test.ts` 覆盖请求校验（用 Request 对象直接调 route handler）与假适配器输出为 JPEG 且尺寸正确。

类型检查：`tsc --noEmit`。

人工验收：

- M1：本地底模渲染，换一件上衣无错位，动画时衣服跟随，观察穿模程度。
- M2：七个槽位、预设、底模切换、缩略图。
- M3：云托管默认域名上生成假海报并下载。
- M4：首页在云托管默认域名上打开不加载 three 与模型，点「开始创建」进入换装页。

## 10. 为 B 与 C 预留

- `avatarStore.replace(next)` 与 `saves.ts` 的 `toSaveRecord`、`fromSaveRecord` 保留，B 用它们做云端保存与恢复；`SaveRecord` 去掉 `variants` 字段。
- `PosterProvider` 接口不变，C 增加真实适配器文件，`index.ts` 多一个分支。
- 海报弹窗的「生成中」态按 10 到 30 秒耗时设计，C 接真服务时只改文案。
- B 的数据层用云开发文档型数据库与 `@cloudbase/node-sdk`，不用 MySQL；登录用云开发身份认证；封面存云存储。A 不引入这些依赖。

## 11. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| A0 | 迁移骨架：Next 项目结构、`/` 与 `/create` 两个空壳路由、令牌与字体、3D 层与规则层搬入、测试通过、删除 Vue 相关文件 | `npm run build` 与 `npm test` 通过，两个路由显示空壳 |
| A1 | 资源脚本改造并生成资源进 git；Viewport 渲染底模与一件上衣 | M1 |
| A2 | store、viewerSync、PartsPanel、套装、底模切换、缩略图 | M2 |
| A3 | 海报接口、假适配器、弹窗、截图下载 | 本地生成并下载 |
| A4 | 首页四段与页脚，用 A3 产出的假海报做首屏素材 | 本地首页完整，点入换装页 |
| A5 | Dockerfile、本地镜像跑通、云托管部署、环境变量 | M3、M4 |

## 12. 风险

- 穿模：免费层底模是紧身衣超级英雄，服装为 Regular 底模设计，套在外面可能在袖口领口露底。M1 看结果，严重时考虑付费 Regular 底模。
- 男装与男底模的逆绑定矩阵有差异，M1 用男性穿游侠看肩甲和腰带有无错位。
- 0.5 GB 内存跑 Next 加 sharp 可能吃紧，首次部署后看内存曲线。
- 云端构建需要能拉到 npm 与 sharp 预编译包，`.npmrc` 用国内镜像；拉不到时在本地 build 镜像再推。
- 站酷庆科黄油体只有一个字重，标题不做粗细变化。
