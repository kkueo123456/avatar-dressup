# avatar-dressup 三维换装 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `G:\xuexi\2023\avatar-dressup` 新建一个 Vite + Vue 3 + TypeScript 项目，用 three.js 渲染一个按部位换装的 3D 人物，素材来自 Quaternius 两个共用骨骼的免费包，支持保存、恢复、截图和待机动画，没有后端。

**Architecture:** 三层。`src/avatar/` 是纯 three.js 模块，负责加载底模、把部件的 SkinnedMesh 按骨骼名重绑到底模骨骼、装卸部件、相机灯光截图；`src/state/` 是唯一真相源，纯函数 `slotRules.ts` 决定槽位规则，`viewerSync.ts` 把状态差异推给 3D 层；`src/components/` 只渲染状态和派发动作。数据是一份静态 `public/avatar/manifest.json`，由 `scripts/build-manifest.mjs` 从用户解压的素材目录生成。

**Tech Stack:** Node 22、Vite、Vue 3（`<script setup lang="ts">`）、TypeScript strict、three 最新版 + `@types/three`、idb-keyval、Vitest、@gltf-transform/core + extensions + functions、fast-glob。

**Spec:** `docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md`（Task 1 会把它和本计划一起迁入新仓库）。

## Global Constraints

- 新项目路径固定为 `G:\xuexi\2023\avatar-dressup`，独立 git 仓库，默认分支 `main`。旧仓库 `sass-fore-end-v2` 的源码一律不改。
- TypeScript `strict: true`，`vue-tsc --noEmit` 必须通过。
- 不引入 vue-router、任何状态库、ant-design-vue 或其他 UI 组件库。面板、抽屉、弹窗自己写。
- three 与 `@types/three` 一起安装到最新版。所有 three 附加模块从 `three/addons/...` 导入。
- 进 git 的资产只有 `public/avatar/manifest.json`；`public/avatar/models/`、`textures/`、`anim/` 和 `assets-src/` 都在 `.gitignore` 里。
- 骨骼期望数 65，不符只警告不中断。
- 四个服装槽位 id 固定为 `body`、`arms`、`legs`、`feet`；头部槽位 `hair`、`eyebrows`；多选槽位 `accessory`。
- 截图 512x768，保存记录缩略图 384x576 JPEG 质量 0.8，保存上限 50 条。
- 界面文案全部中文。目标是桌面浏览器，宽度 1280 以上。
- 每个任务结束时在新仓库提交一次，提交信息末尾加 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`。
- 执行环境是 Windows + Git Bash。路径用正斜杠，`cd "G:/xuexi/2023/avatar-dressup"` 后再执行命令。

## Review Focus

1. **预设引用了错误槽位的部件**：manifest 里 `presets[].parts.body` 指向一个 `slot: "legs"` 的部件时，校验必须报错而不是在运行时静默装错。测试在 Task 2。
2. **保存记录引用了已不存在的部件**：恢复一个含有 `ranger_body` 的记录而当前 manifest 已没有该部件时，必须跳过并报告，不能整体失败。测试在 Task 4。
3. **部件加载完成前就被卸下**：用户快速点「游侠上衣」再点「无」，异步加载完成后不能把网格挂回场景。测试在 Task 6（AvatarRig 的 pending 守卫）和 Task 8（同步队列）。
4. **换底模时性别不匹配的部件**：女性发型装着时切到男性底模，发型要卸下并被报告，游侠套装（any）要在新底模加载完后重新装上。测试在 Task 3 和 Task 8。
5. **部件缺少骨骼**：部件的骨骼名在底模里找不到时，这件部件放弃并上报缺失骨骼名，其他部件不受影响。测试在 Task 6。

---

## 文件结构

```
avatar-dressup/
  index.html / package.json / vite.config.ts / tsconfig.json / .gitignore / README.md
  docs/ASSETS.md                         素材下载地址与目录（用户要的文档）
  docs/superpowers/specs/…               设计文档（从旧仓库迁入）
  docs/superpowers/plans/…               本计划（从旧仓库迁入）
  assets-src/{base,outfits,anim}/        用户解压的素材，不进 git
  public/avatar/manifest.json            脚本输出，进 git
  public/avatar/{models,textures,anim}/  脚本输出，不进 git
  scripts/lib/classify.mjs               纯函数：文件列表 -> bases/parts/animations/presets
  scripts/manifest.config.mjs            规则表、槽位定义、套装中文名
  scripts/build-manifest.mjs             --scan 列出素材；默认生成 manifest 并复制资源；--optimize 压缩
  src/main.ts / App.vue / env.d.ts
  src/styles/theme.css / base.css
  src/types/manifest.ts / save.ts
  src/data/assetUrl.ts / manifest.ts / saves.ts
  src/avatar/rebind.ts                   纯函数：按骨骼名重绑 SkinnedMesh
  src/avatar/PartLoader.ts               GLTFLoader 缓存
  src/avatar/AvatarRig.ts                底模、部件装卸、变体、动画
  src/avatar/AvatarViewer.ts             渲染器、相机、灯光、聚焦、截图
  src/avatar/ThumbnailRenderer.ts        离屏缩略图 + IndexedDB 缓存
  src/avatar/slotRules.ts                纯函数：槽位规则
  src/state/useAvatarState.ts            组合式状态
  src/state/viewerSync.ts                状态 -> 3D 层 的串行同步
  src/components/DressUp.vue / TopBar.vue / PartsPanel.vue / SlotIcon.vue / BaseSelect.vue / NameDialog.vue / SavesDrawer.vue
  tests/manifest.test.ts / slotRules.test.ts / saves.test.ts / classify.test.mjs / rebind.test.ts / avatarRig.test.ts / useAvatarState.test.ts / viewerSync.test.ts
```

共享测试夹具 `tests/fixtures/manifest.ts` 在 Task 2 创建，Task 3、4、8 复用。

---

### Task 1: 项目骨架、文档、主题、迁移设计文档

**Files:**
- Create: `package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`.gitignore`、`README.md`
- Create: `src/main.ts`、`src/App.vue`、`src/env.d.ts`、`src/styles/theme.css`、`src/styles/base.css`
- Create: `docs/ASSETS.md`
- Copy: 旧仓库 `docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md` 与 `docs/superpowers/plans/2026-10-08-avatar-dressup.md` 到新仓库同路径
- Modify（旧仓库）: 用 `git revert` 撤掉三次文档提交

**Interfaces:**
- Produces: `@` 别名指向 `src/`；`npm run dev|build|typecheck|test|assets:scan|assets:build` 五个脚本；CSS 变量 `--bg --panel --panel-deep --text --text-muted --accent --border --btn-transparent --light`；`html[data-theme]` 取值 `dark | night | light | purple`。

- [ ] **Step 1: 建目录并初始化 git**

```bash
mkdir -p "G:/xuexi/2023/avatar-dressup" && cd "G:/xuexi/2023/avatar-dressup" && git init -b main && mkdir -p src/styles src/types src/data src/avatar src/state src/components scripts/lib tests/fixtures docs/superpowers/specs docs/superpowers/plans public/avatar assets-src/base assets-src/outfits assets-src/anim
```

- [ ] **Step 2: 写 package.json**

```json
{
  "name": "avatar-dressup",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "assets:scan": "node scripts/build-manifest.mjs --scan",
    "assets:build": "node scripts/build-manifest.mjs"
  }
}
```

- [ ] **Step 3: 安装依赖（全部取最新版）**

```bash
cd "G:/xuexi/2023/avatar-dressup" && npm install vue three @types/three idb-keyval && npm install -D vite @vitejs/plugin-vue typescript vue-tsc vitest @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions fast-glob
```

Expected: `package.json` 出现 dependencies 与 devDependencies，`node_modules` 生成。记录 `npm ls three @types/three --depth=0` 的版本号到 README 的「依赖版本」一节。

- [ ] **Step 4: 写 vite.config.ts、tsconfig.json、env.d.ts、index.html**

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "tests/**/*.ts", "vite.config.ts"]
}
```

`src/env.d.ts`:
```ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
```

`index.html`:
```html
<!doctype html>
<html lang="zh-CN" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>虚拟人换装</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 写主题与基础样式**

`src/styles/theme.css`（颜色值来自旧仓库 `bodyColorConfig.less` 的四套主题）:
```css
:root,
[data-theme='dark'] {
  --bg: #282c35;
  --panel: #20232a;
  --panel-deep: #181b1f;
  --text: rgba(255, 255, 255, 0.9);
  --text-muted: rgba(255, 255, 255, 0.6);
  --accent: #0099ff;
  --border: rgba(255, 255, 255, 0.2);
  --btn-transparent: rgba(255, 255, 255, 0.1);
  --light: #373c46;
}
[data-theme='night'] {
  --bg: #27272a;
  --panel: #18181b;
  --panel-deep: #060607;
  --text: rgba(255, 255, 255, 0.9);
  --text-muted: rgba(255, 255, 255, 0.6);
  --accent: #0099ff;
  --border: rgba(255, 255, 255, 0.2);
  --btn-transparent: rgba(255, 255, 255, 0.1);
  --light: #4e4e56;
}
[data-theme='light'] {
  --bg: #f2f2f2;
  --panel: #ffffff;
  --panel-deep: #e0e0e0;
  --text: rgba(0, 0, 0, 0.9);
  --text-muted: rgba(0, 0, 0, 0.6);
  --accent: #0099ff;
  --border: rgba(0, 0, 0, 0.2);
  --btn-transparent: rgba(0, 0, 0, 0.1);
  --light: #6e6e6e;
}
[data-theme='purple'] {
  --bg: #6e48b0;
  --panel: #271247;
  --panel-deep: #1b0935;
  --text: rgba(255, 255, 255, 0.9);
  --text-muted: rgba(255, 255, 255, 0.6);
  --accent: #0099ff;
  --border: rgba(255, 255, 255, 0.2);
  --btn-transparent: rgba(255, 255, 255, 0.1);
  --light: #4e4e56;
}
```

`src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 -apple-system, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  overflow: hidden;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
select,
input {
  font: inherit;
}
```

- [ ] **Step 6: 写 main.ts 与占位 App.vue**

`src/main.ts`:
```ts
import { createApp } from 'vue'
import App from './App.vue'
import './styles/theme.css'
import './styles/base.css'

createApp(App).mount('#app')
```

`src/App.vue`:
```vue
<script setup lang="ts"></script>

<template>
  <div class="placeholder">avatar-dressup 骨架已就绪</div>
</template>

<style scoped>
.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--text-muted);
}
</style>
```

- [ ] **Step 7: 写 .gitignore**

```
node_modules
dist
assets-src/
public/avatar/models/
public/avatar/textures/
public/avatar/anim/
*.local
.DS_Store
```

- [ ] **Step 8: 写 docs/ASSETS.md（用户要的素材说明）**

````markdown
# 素材下载与放置说明

本项目不带任何 3D 模型。模型来自 Quaternius 的免费素材包，所有部件共用同一副 65 关节骨骼，所以可以互相组合。请按下面步骤下载并解压到指定目录，然后运行脚本生成 `public/avatar/manifest.json`。

## 1. 下载

| 包 | 下载地址 | 下载哪个文件 | 免费层包含 |
|---|---|---|---|
| Universal Base Characters（底模与发型） | https://quaternius.itch.io/universal-base-characters | Standard zip，约 122 MB | 2 个底模、5 个发型 |
| Modular Character Outfits - Fantasy（服装部件） | https://quaternius.itch.io/modular-character-outfits-fantasy | Standard zip，约 280 MB | Ranger、Peasant 两套 |
| Universal Animation Library（动画，取 Idle） | https://quaternius.itch.io/universal-animation-library | Standard zip，约 13 MB | 45 个动画 |

操作：打开页面，点「Download Now」，弹出付费框时选「No thanks, just take me to the downloads」，然后只下载 Standard zip。想要全部底模、发型和 12 套服装，前两个包各约 20 美元，下载 Standard 即可，Source 是 Blender 工程不需要。

许可：itch 页面标注 CC0，以 zip 内 LICENSE 文件为准。

## 2. 解压到这些目录

```
avatar-dressup/
  assets-src/
    base/      <- Universal Base Characters 解压后的全部内容
    outfits/   <- Modular Character Outfits - Fantasy 解压后的全部内容
    anim/      <- Universal Animation Library 解压后的全部内容
```

子目录层级不限，脚本会递归扫描。`assets-src/` 已在 `.gitignore` 里，不会提交。

## 3. 生成 manifest

先看脚本识别到了什么：

```bash
npm run assets:scan
```

它会列出每个 glb/gltf 文件、网格名、骨骼数、动画名，以及所有 PNG 贴图。如果某些文件归类不对，改 `scripts/manifest.config.mjs` 里的 `rules`。

然后生成：

```bash
npm run assets:build
```

输出 `public/avatar/manifest.json`，并把模型复制为单文件 glb 到 `public/avatar/models/`，贴图到 `public/avatar/textures/`，动画到 `public/avatar/anim/`。加 `-- --optimize` 可做网格去重与贴图缩放。

## 4. 启动

```bash
npm run dev
```
````

- [ ] **Step 9: 写 README.md**

```markdown
# avatar-dressup

基于 three.js 的 3D 虚拟人换装，Vite + Vue 3 + TypeScript，无后端。

- 素材下载与目录：见 [docs/ASSETS.md](docs/ASSETS.md)
- 设计文档：`docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-08-avatar-dressup.md`

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 打包 |
| `npm run typecheck` | 仅类型检查 |
| `npm test` | 单元测试 |
| `npm run assets:scan` | 列出 assets-src 里识别到的素材 |
| `npm run assets:build` | 生成 manifest 并复制资源 |

## 依赖版本

（Task 1 Step 3 安装后填入 three 与 @types/three 的版本号）
```

- [ ] **Step 10: 迁入设计文档与计划，验证骨架**

```bash
cp "G:/xuexi/2023/sass-fore-end-v2/docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md" "G:/xuexi/2023/avatar-dressup/docs/superpowers/specs/" && cp "G:/xuexi/2023/sass-fore-end-v2/docs/superpowers/plans/2026-10-08-avatar-dressup.md" "G:/xuexi/2023/avatar-dressup/docs/superpowers/plans/" && cd "G:/xuexi/2023/avatar-dressup" && npm run typecheck && npm run build
```

Expected: typecheck 无错误，`dist/` 生成。然后把 README「依赖版本」一节填上实际版本号。

- [ ] **Step 11: 提交新仓库**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "chore: 项目骨架、主题、素材说明与设计文档" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 12: 旧仓库撤掉文档提交**

在旧仓库查看最近三次提交应为「docs: 实施计划」「docs: 换装设计第 2 版」「docs: three.js 虚拟人换装重建设计文档」，然后：

```bash
cd "G:/xuexi/2023/sass-fore-end-v2" && git log --oneline -4 && git revert --no-commit HEAD HEAD~1 HEAD~2 && git commit -m "docs: 设计文档与计划已迁移到 avatar-dressup 仓库" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git status --short
```

Expected: `docs/superpowers/` 在旧仓库消失，`src/views/createModel/createUnityModel.vue` 的用户改动仍是未暂存状态。若 `git log` 显示的三次提交不是上述文档提交，停下来核对哈希，不要 revert 别的提交。若 git 提示 index 有未提交改动而拒绝 revert，先 `git stash push -- src/views/createModel/createUnityModel.vue`，revert 并提交后 `git stash pop`，确认该文件改动回到工作区。

---

### Task 2: 类型定义与 manifest 校验

**Files:**
- Create: `src/types/manifest.ts`、`src/data/assetUrl.ts`、`src/data/manifest.ts`
- Create: `tests/fixtures/manifest.ts`、`tests/manifest.test.ts`

**Interfaces:**
- Produces: 类型 `Manifest, BaseModel, Slot, Part, Variant, Preset, AnimationRef, Sex, SlotGroup`；`validateManifest(raw: unknown): Manifest`（失败抛 `ManifestError`，其 `problems: string[]` 列出全部问题）；`loadManifest(url?: string): Promise<Manifest>`；`assetUrl(path: string): string` 把 manifest 里的相对路径变成 `${BASE_URL}avatar/${path}`。
- 夹具 `makeManifest(): Manifest`：两个底模（`female_regular`、`male_regular`），七个槽位，部件 `ranger_body/arms/legs/feet`（set `ranger`，sex any，body 带两个变体 a/b）、`peasant_body/arms/legs/feet`（set `peasant`）、`hair_f`（female）、`hair_m`（male）、`hood`、`pauldron`（accessory，any），预设 `ranger`、`peasant`，动画 `idle`。

- [ ] **Step 1: 写类型文件**

`src/types/manifest.ts`:
```ts
export type Sex = 'male' | 'female' | 'any'
export type SlotGroup = 'head' | 'outfit'

export interface Manifest {
  version: number
  skeleton: { rootBone: string; expectedBones: number }
  bases: BaseModel[]
  slots: Slot[]
  parts: Part[]
  presets: Preset[]
  animations: AnimationRef[]
}

export interface BaseModel {
  id: string
  sex: Exclude<Sex, 'any'>
  label: string
  url: string
  /** 会被服装隐藏的网格名 */
  bodyMeshes: string[]
  /** 永远可见的网格名 */
  headMeshes: string[]
}

export interface Slot {
  id: string
  label: string
  group: SlotGroup
  /** 允许同时装多个（配饰） */
  multiple: boolean
  /** 参与底模可见性与预设补全（body/arms/legs/feet） */
  outfit: boolean
}

export interface Variant {
  id: string
  label: string
  textures: { map: string }
}

export interface Part {
  id: string
  slot: string
  set: string | null
  label: string
  sex: Sex
  url: string
  variants: Variant[]
}

export interface Preset {
  id: string
  label: string
  /** slotId -> partId */
  parts: Record<string, string>
}

export interface AnimationRef {
  id: string
  label: string
  url: string
  clip: string
}
```

`src/data/assetUrl.ts`:
```ts
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}avatar/${path.replace(/^\/+/, '')}`
}
```

- [ ] **Step 2: 写测试夹具**

`tests/fixtures/manifest.ts`:
```ts
import type { Manifest, Part } from '@/types/manifest'

function outfit(set: string, slot: string): Part {
  return {
    id: `${set}_${slot}`,
    slot,
    set,
    label: `${set} ${slot}`,
    sex: 'any',
    url: `models/outfits/${set}/${set}_${slot}.glb`,
    variants:
      slot === 'body'
        ? [
            { id: 'a', label: 'A', textures: { map: `textures/${set}/${set}_A.png` } },
            { id: 'b', label: 'B', textures: { map: `textures/${set}/${set}_B.png` } },
          ]
        : [],
  }
}

export function makeManifest(): Manifest {
  return {
    version: 1,
    skeleton: { rootBone: 'root', expectedBones: 65 },
    bases: [
      { id: 'female_regular', sex: 'female', label: '女性', url: 'models/base/Female.glb', bodyMeshes: ['Body'], headMeshes: ['Head'] },
      { id: 'male_regular', sex: 'male', label: '男性', url: 'models/base/Male.glb', bodyMeshes: ['Body'], headMeshes: ['Head'] },
    ],
    slots: [
      { id: 'hair', label: '发型', group: 'head', multiple: false, outfit: false },
      { id: 'eyebrows', label: '眉毛', group: 'head', multiple: false, outfit: false },
      { id: 'body', label: '上身', group: 'outfit', multiple: false, outfit: true },
      { id: 'arms', label: '手臂', group: 'outfit', multiple: false, outfit: true },
      { id: 'legs', label: '腿部', group: 'outfit', multiple: false, outfit: true },
      { id: 'feet', label: '鞋靴', group: 'outfit', multiple: false, outfit: true },
      { id: 'accessory', label: '配饰', group: 'outfit', multiple: true, outfit: false },
    ],
    parts: [
      outfit('ranger', 'body'), outfit('ranger', 'arms'), outfit('ranger', 'legs'), outfit('ranger', 'feet'),
      outfit('peasant', 'body'), outfit('peasant', 'arms'), outfit('peasant', 'legs'), outfit('peasant', 'feet'),
      { id: 'hair_f', slot: 'hair', set: null, label: '女发', sex: 'female', url: 'models/base/Hair_F.glb', variants: [] },
      { id: 'hair_m', slot: 'hair', set: null, label: '男发', sex: 'male', url: 'models/base/Hair_M.glb', variants: [] },
      { id: 'hood', slot: 'accessory', set: 'ranger', label: '兜帽', sex: 'any', url: 'models/outfits/ranger/Hood.glb', variants: [] },
      { id: 'pauldron', slot: 'accessory', set: null, label: '护肩', sex: 'any', url: 'models/outfits/misc/Pauldron.glb', variants: [] },
    ],
    presets: [
      { id: 'ranger', label: '游侠', parts: { body: 'ranger_body', arms: 'ranger_arms', legs: 'ranger_legs', feet: 'ranger_feet' } },
      { id: 'peasant', label: '农夫', parts: { body: 'peasant_body', arms: 'peasant_arms', legs: 'peasant_legs', feet: 'peasant_feet' } },
    ],
    animations: [{ id: 'idle', label: '待机', url: 'anim/Idle.glb', clip: 'Idle' }],
  }
}

export function part(m: Manifest, id: string): Part {
  const p = m.parts.find((x) => x.id === id)
  if (!p) throw new Error(`fixture 没有部件 ${id}`)
  return p
}
```

- [ ] **Step 3: 写失败的校验测试**

`tests/manifest.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ManifestError, validateManifest } from '@/data/manifest'
import { makeManifest } from './fixtures/manifest'

function problemsOf(raw: unknown): string[] {
  try {
    validateManifest(raw)
  } catch (e) {
    if (e instanceof ManifestError) return e.problems
    throw e
  }
  return []
}

describe('validateManifest', () => {
  it('合法 manifest 原样返回', () => {
    const m = makeManifest()
    expect(validateManifest(m)).toEqual(m)
  })

  it('根节点不是对象时报错', () => {
    expect(problemsOf(null)).toEqual(['根节点必须是对象'])
  })

  it('缺 bases 和 slots 时同时报告两个问题', () => {
    const m = makeManifest() as unknown as Record<string, unknown>
    delete m.bases
    delete m.slots
    const problems = problemsOf(m)
    expect(problems.some((p) => p.includes('bases'))).toBe(true)
    expect(problems.some((p) => p.includes('slots'))).toBe(true)
  })

  it('部件引用不存在的槽位时报错并指出部件 id', () => {
    const m = makeManifest()
    m.parts[0].slot = 'tail'
    const problems = problemsOf(m)
    expect(problems).toContain('部件 ranger_body 引用了不存在的槽位 tail')
  })

  it('重复的部件 id 报错', () => {
    const m = makeManifest()
    m.parts[1].id = m.parts[0].id
    expect(problemsOf(m)).toContain('部件 id 重复：ranger_body')
  })

  it('预设引用了错误槽位的部件时报错', () => {
    const m = makeManifest()
    m.presets[0].parts.body = 'ranger_legs'
    expect(problemsOf(m)).toContain('预设 ranger 的槽位 body 指向的部件 ranger_legs 属于槽位 legs')
  })

  it('预设引用不存在的部件时报错', () => {
    const m = makeManifest()
    m.presets[0].parts.body = 'nope'
    expect(problemsOf(m)).toContain('预设 ranger 引用了不存在的部件 nope')
  })

  it('底模 sex 不合法时报错', () => {
    const m = makeManifest() as unknown as { bases: { sex: string }[] }
    m.bases[0].sex = 'any'
    expect(problemsOf(m)).toContain('底模 female_regular 的 sex 必须是 male 或 female')
  })

  it('变体缺少 textures.map 时报错', () => {
    const m = makeManifest() as unknown as { parts: { variants: { textures: unknown }[] }[] }
    m.parts[0].variants[0].textures = {}
    expect(problemsOf(m)).toContain('部件 ranger_body 的变体 a 缺少 textures.map')
  })
})
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/manifest.test.ts`
Expected: FAIL，提示找不到模块 `@/data/manifest`。

- [ ] **Step 5: 实现校验**

`src/data/manifest.ts`:
```ts
import type { Manifest } from '@/types/manifest'
import { assetUrl } from './assetUrl'

export class ManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(`manifest 校验失败：\n${problems.join('\n')}`)
    this.name = 'ManifestError'
  }
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

export function validateManifest(raw: unknown): Manifest {
  if (!isRec(raw)) throw new ManifestError(['根节点必须是对象'])
  const problems: string[] = []
  const push = (p: string) => problems.push(p)

  if (typeof raw.version !== 'number') push('version 必须是数字')
  if (!isRec(raw.skeleton) || !isStr(raw.skeleton.rootBone) || typeof raw.skeleton.expectedBones !== 'number') {
    push('skeleton 需要 rootBone(string) 与 expectedBones(number)')
  }

  const arr = (key: string): unknown[] => {
    const v = raw[key]
    if (!Array.isArray(v)) {
      push(`${key} 必须是数组`)
      return []
    }
    return v
  }
  const bases = arr('bases')
  const slots = arr('slots')
  const parts = arr('parts')
  const presets = arr('presets')
  const animations = arr('animations')

  if (Array.isArray(raw.bases) && bases.length === 0) push('bases 至少需要一个底模')
  if (Array.isArray(raw.slots) && slots.length === 0) push('slots 至少需要一个槽位')

  const baseIds = new Set<string>()
  for (const b of bases) {
    if (!isRec(b) || !isStr(b.id)) { push('底模缺少 id'); continue }
    if (baseIds.has(b.id)) push(`底模 id 重复：${b.id}`)
    baseIds.add(b.id)
    if (b.sex !== 'male' && b.sex !== 'female') push(`底模 ${b.id} 的 sex 必须是 male 或 female`)
    if (!isStr(b.label)) push(`底模 ${b.id} 缺少 label`)
    if (!isStr(b.url)) push(`底模 ${b.id} 缺少 url`)
    if (!isStrArr(b.bodyMeshes)) push(`底模 ${b.id} 的 bodyMeshes 必须是字符串数组`)
    if (!isStrArr(b.headMeshes)) push(`底模 ${b.id} 的 headMeshes 必须是字符串数组`)
  }

  const slotIds = new Set<string>()
  for (const s of slots) {
    if (!isRec(s) || !isStr(s.id)) { push('槽位缺少 id'); continue }
    if (slotIds.has(s.id)) push(`槽位 id 重复：${s.id}`)
    slotIds.add(s.id)
    if (!isStr(s.label)) push(`槽位 ${s.id} 缺少 label`)
    if (s.group !== 'head' && s.group !== 'outfit') push(`槽位 ${s.id} 的 group 必须是 head 或 outfit`)
    if (!isBool(s.multiple)) push(`槽位 ${s.id} 的 multiple 必须是布尔值`)
    if (!isBool(s.outfit)) push(`槽位 ${s.id} 的 outfit 必须是布尔值`)
  }

  const partSlot = new Map<string, string>()
  for (const p of parts) {
    if (!isRec(p) || !isStr(p.id)) { push('部件缺少 id'); continue }
    if (partSlot.has(p.id)) push(`部件 id 重复：${p.id}`)
    if (!isStr(p.slot)) push(`部件 ${p.id} 缺少 slot`)
    else if (!slotIds.has(p.slot)) push(`部件 ${p.id} 引用了不存在的槽位 ${p.slot}`)
    partSlot.set(p.id, isStr(p.slot) ? p.slot : '')
    if (p.set !== null && !isStr(p.set)) push(`部件 ${p.id} 的 set 必须是字符串或 null`)
    if (!isStr(p.label)) push(`部件 ${p.id} 缺少 label`)
    if (p.sex !== 'male' && p.sex !== 'female' && p.sex !== 'any') push(`部件 ${p.id} 的 sex 必须是 male、female 或 any`)
    if (!isStr(p.url)) push(`部件 ${p.id} 缺少 url`)
    if (!Array.isArray(p.variants)) { push(`部件 ${p.id} 的 variants 必须是数组`); continue }
    const vIds = new Set<string>()
    for (const v of p.variants) {
      if (!isRec(v) || !isStr(v.id)) { push(`部件 ${p.id} 有变体缺少 id`); continue }
      if (vIds.has(v.id)) push(`部件 ${p.id} 的变体 id 重复：${v.id}`)
      vIds.add(v.id)
      if (!isStr(v.label)) push(`部件 ${p.id} 的变体 ${v.id} 缺少 label`)
      if (!isRec(v.textures) || !isStr(v.textures.map)) push(`部件 ${p.id} 的变体 ${v.id} 缺少 textures.map`)
    }
  }

  const presetIds = new Set<string>()
  for (const pr of presets) {
    if (!isRec(pr) || !isStr(pr.id)) { push('预设缺少 id'); continue }
    if (presetIds.has(pr.id)) push(`预设 id 重复：${pr.id}`)
    presetIds.add(pr.id)
    if (!isStr(pr.label)) push(`预设 ${pr.id} 缺少 label`)
    if (!isRec(pr.parts)) { push(`预设 ${pr.id} 的 parts 必须是对象`); continue }
    for (const [slotId, partId] of Object.entries(pr.parts)) {
      if (!slotIds.has(slotId)) push(`预设 ${pr.id} 引用了不存在的槽位 ${slotId}`)
      if (!isStr(partId) || !partSlot.has(partId)) { push(`预设 ${pr.id} 引用了不存在的部件 ${String(partId)}`); continue }
      const actual = partSlot.get(partId)
      if (actual !== slotId) push(`预设 ${pr.id} 的槽位 ${slotId} 指向的部件 ${partId} 属于槽位 ${actual}`)
    }
  }

  const animIds = new Set<string>()
  for (const a of animations) {
    if (!isRec(a) || !isStr(a.id)) { push('动画缺少 id'); continue }
    if (animIds.has(a.id)) push(`动画 id 重复：${a.id}`)
    animIds.add(a.id)
    if (!isStr(a.label)) push(`动画 ${a.id} 缺少 label`)
    if (!isStr(a.url)) push(`动画 ${a.id} 缺少 url`)
    if (!isStr(a.clip)) push(`动画 ${a.id} 缺少 clip`)
  }

  if (problems.length) throw new ManifestError(problems)
  return raw as unknown as Manifest
}

export async function loadManifest(url = assetUrl('manifest.json')): Promise<Manifest> {
  const res = await fetch(url)
  if (!res.ok) throw new ManifestError([`无法读取 ${url}：HTTP ${res.status}`])
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new ManifestError([`${url} 不是合法 JSON`])
  }
  return validateManifest(json)
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/manifest.test.ts && npm run typecheck`
Expected: 9 个测试 PASS，typecheck 无错误。

- [ ] **Step 7: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: manifest 类型定义与校验" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 槽位规则纯函数 slotRules

**Files:**
- Create: `src/avatar/slotRules.ts`
- Test: `tests/slotRules.test.ts`

**Interfaces:**
- Consumes: Task 2 的类型与夹具。
- Produces:
  - `interface AvatarState { baseId: string; equipped: Record<string, string[]>; variants: Record<string, string> }`
  - `createEmptyState(manifest, baseId): AvatarState`
  - `partFitsBase(part, base): boolean`
  - `partsForSlot(manifest, slotId, base): Part[]`
  - `isOutfitEmpty(state, slots): boolean` 与 `computeBodyVisible(state, slots): boolean`（后者等于前者，语义命名）
  - `equipPart(state, part, manifest): AvatarState`（首件服装触发同套补全）
  - `fillOutfitFromSet(state, part, manifest): AvatarState`
  - `unequipPart(state, slotId, partId?): AvatarState`（不传 partId 清空整个槽位，同时删除被卸部件的变体）
  - `applyPreset(state, preset, manifest): AvatarState`
  - `setVariant(state, partId, variantId): AvatarState`
  - `changeBase(state, base, manifest): { state: AvatarState; removed: Part[] }`
  - 所有函数不修改入参，返回新对象。

- [ ] **Step 1: 写失败的测试**

`tests/slotRules.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  applyPreset, changeBase, computeBodyVisible, createEmptyState, equipPart,
  partsForSlot, setVariant, unequipPart,
} from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()
const female = m.bases[0]
const male = m.bases[1]

describe('createEmptyState', () => {
  it('每个槽位都是空数组，底模身体可见', () => {
    const s = createEmptyState(m, female.id)
    expect(Object.keys(s.equipped).sort()).toEqual(m.slots.map((x) => x.id).sort())
    expect(Object.values(s.equipped).every((v) => v.length === 0)).toBe(true)
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })
})

describe('equipPart', () => {
  it('服装全空时装第一件会补全同套其余三件，并隐藏底模身体', () => {
    const s0 = createEmptyState(m, female.id)
    const s1 = equipPart(s0, part(m, 'ranger_body'), m)
    expect(s1.equipped.body).toEqual(['ranger_body'])
    expect(s1.equipped.arms).toEqual(['ranger_arms'])
    expect(s1.equipped.legs).toEqual(['ranger_legs'])
    expect(s1.equipped.feet).toEqual(['ranger_feet'])
    expect(computeBodyVisible(s1, m.slots)).toBe(false)
    expect(s0.equipped.body).toEqual([])
  })

  it('已穿服装时换一件只改该槽位', () => {
    const s1 = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    const s2 = equipPart(s1, part(m, 'peasant_legs'), m)
    expect(s2.equipped.legs).toEqual(['peasant_legs'])
    expect(s2.equipped.body).toEqual(['ranger_body'])
    expect(s2.equipped.arms).toEqual(['ranger_arms'])
  })

  it('多选槽位累加且不重复', () => {
    let s = createEmptyState(m, female.id)
    s = equipPart(s, part(m, 'hood'), m)
    s = equipPart(s, part(m, 'pauldron'), m)
    s = equipPart(s, part(m, 'hood'), m)
    expect(s.equipped.accessory).toEqual(['hood', 'pauldron'])
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })

  it('没有 set 的服装不会触发补全', () => {
    const loose = { ...part(m, 'ranger_body'), id: 'loose_body', set: null }
    const mm = { ...m, parts: [...m.parts, loose] }
    const s = equipPart(createEmptyState(mm, female.id), loose, mm)
    expect(s.equipped.arms).toEqual([])
  })

  it('补全时跳过与底模性别不符的同套部件', () => {
    const mm = makeManifest()
    part(mm, 'ranger_arms').sex = 'male'
    const s = equipPart(createEmptyState(mm, female.id), part(mm, 'ranger_body'), mm)
    expect(s.equipped.arms).toEqual([])
    expect(s.equipped.legs).toEqual(['ranger_legs'])
  })
})

describe('unequipPart', () => {
  it('卸下单个部件并清掉它的变体', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    s = setVariant(s, 'ranger_body', 'b')
    s = unequipPart(s, 'body')
    expect(s.equipped.body).toEqual([])
    expect(s.variants.ranger_body).toBeUndefined()
    expect(computeBodyVisible(s, m.slots)).toBe(false)
  })

  it('多选槽位只卸指定的一个', () => {
    let s = createEmptyState(m, female.id)
    s = equipPart(s, part(m, 'hood'), m)
    s = equipPart(s, part(m, 'pauldron'), m)
    s = unequipPart(s, 'accessory', 'hood')
    expect(s.equipped.accessory).toEqual(['pauldron'])
  })

  it('四个服装槽位全卸后底模身体重新可见', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    for (const id of ['body', 'arms', 'legs', 'feet']) s = unequipPart(s, id)
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })
})

describe('applyPreset', () => {
  it('整套替换四个服装槽位，不动其他槽位', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    s = equipPart(s, part(m, 'hair_f'), m)
    s = applyPreset(s, m.presets[1], m)
    expect(s.equipped.body).toEqual(['peasant_body'])
    expect(s.equipped.feet).toEqual(['peasant_feet'])
    expect(s.equipped.hair).toEqual(['hair_f'])
  })
})

describe('changeBase', () => {
  it('卸下性别不匹配的部件并返回它们，保留 any 部件', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'hair_f'), m)
    s = equipPart(s, part(m, 'ranger_body'), m)
    const r = changeBase(s, male, m)
    expect(r.state.baseId).toBe('male_regular')
    expect(r.state.equipped.hair).toEqual([])
    expect(r.state.equipped.body).toEqual(['ranger_body'])
    expect(r.removed.map((p) => p.id)).toEqual(['hair_f'])
  })
})

describe('partsForSlot', () => {
  it('按底模性别过滤', () => {
    expect(partsForSlot(m, 'hair', female).map((p) => p.id)).toEqual(['hair_f'])
    expect(partsForSlot(m, 'hair', male).map((p) => p.id)).toEqual(['hair_m'])
    expect(partsForSlot(m, 'body', male).map((p) => p.id)).toEqual(['ranger_body', 'peasant_body'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/slotRules.test.ts`
Expected: FAIL，找不到模块 `@/avatar/slotRules`。

- [ ] **Step 3: 实现**

`src/avatar/slotRules.ts`:
```ts
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'

export interface AvatarState {
  baseId: string
  /** slotId -> partId[]；单选槽位数组长度为 0 或 1 */
  equipped: Record<string, string[]>
  /** partId -> variantId */
  variants: Record<string, string>
}

export function createEmptyState(manifest: Manifest, baseId: string): AvatarState {
  const equipped: Record<string, string[]> = {}
  for (const s of manifest.slots) equipped[s.id] = []
  return { baseId, equipped, variants: {} }
}

export function partFitsBase(part: Part, base: BaseModel): boolean {
  return part.sex === 'any' || part.sex === base.sex
}

export function partsForSlot(manifest: Manifest, slotId: string, base: BaseModel): Part[] {
  return manifest.parts.filter((p) => p.slot === slotId && partFitsBase(p, base))
}

export function isOutfitEmpty(state: AvatarState, slots: Slot[]): boolean {
  return slots.filter((s) => s.outfit).every((s) => (state.equipped[s.id] ?? []).length === 0)
}

export function computeBodyVisible(state: AvatarState, slots: Slot[]): boolean {
  return isOutfitEmpty(state, slots)
}

function slotOf(manifest: Manifest, slotId: string): Slot {
  const slot = manifest.slots.find((s) => s.id === slotId)
  if (!slot) throw new Error(`未知槽位 ${slotId}`)
  return slot
}

function baseOf(state: AvatarState, manifest: Manifest): BaseModel | undefined {
  return manifest.bases.find((b) => b.id === state.baseId)
}

export function fillOutfitFromSet(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  if (!part.set) return state
  const base = baseOf(state, manifest)
  const equipped = { ...state.equipped }
  for (const slot of manifest.slots) {
    if (!slot.outfit || slot.id === part.slot) continue
    if ((equipped[slot.id] ?? []).length) continue
    const match = manifest.parts.find(
      (p) => p.slot === slot.id && p.set === part.set && (!base || partFitsBase(p, base)),
    )
    if (match) equipped[slot.id] = [match.id]
  }
  return { ...state, equipped }
}

export function equipPart(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  const slot = slotOf(manifest, part.slot)
  const wasOutfitEmpty = isOutfitEmpty(state, manifest.slots)
  const current = state.equipped[slot.id] ?? []
  const nextList = slot.multiple
    ? current.includes(part.id) ? current : [...current, part.id]
    : [part.id]
  const variants = { ...state.variants }
  for (const id of current) if (!nextList.includes(id)) delete variants[id]
  let next: AvatarState = { ...state, equipped: { ...state.equipped, [slot.id]: nextList }, variants }
  if (slot.outfit && wasOutfitEmpty) next = fillOutfitFromSet(next, part, manifest)
  return next
}

export function unequipPart(state: AvatarState, slotId: string, partId?: string): AvatarState {
  const current = state.equipped[slotId] ?? []
  const nextList = partId === undefined ? [] : current.filter((id) => id !== partId)
  const variants = { ...state.variants }
  for (const id of current) if (!nextList.includes(id)) delete variants[id]
  return { ...state, equipped: { ...state.equipped, [slotId]: nextList }, variants }
}

export function applyPreset(state: AvatarState, preset: Preset, manifest: Manifest): AvatarState {
  let next = state
  for (const slot of manifest.slots) if (slot.outfit) next = unequipPart(next, slot.id)
  const base = baseOf(next, manifest)
  const equipped = { ...next.equipped }
  for (const [slotId, partId] of Object.entries(preset.parts)) {
    const p = manifest.parts.find((x) => x.id === partId)
    if (p && p.slot === slotId && (!base || partFitsBase(p, base))) equipped[slotId] = [p.id]
  }
  return { ...next, equipped }
}

export function setVariant(state: AvatarState, partId: string, variantId: string): AvatarState {
  return { ...state, variants: { ...state.variants, [partId]: variantId } }
}

export function changeBase(
  state: AvatarState,
  base: BaseModel,
  manifest: Manifest,
): { state: AvatarState; removed: Part[] } {
  const removed: Part[] = []
  const equipped: Record<string, string[]> = {}
  for (const [slotId, ids] of Object.entries(state.equipped)) {
    equipped[slotId] = ids.filter((id) => {
      const p = manifest.parts.find((x) => x.id === id)
      if (!p) return false
      if (partFitsBase(p, base)) return true
      removed.push(p)
      return false
    })
  }
  const variants = { ...state.variants }
  for (const p of removed) delete variants[p.id]
  return { state: { baseId: base.id, equipped, variants }, removed }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/slotRules.test.ts && npm run typecheck`
Expected: 13 个测试 PASS。

- [ ] **Step 5: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 槽位规则纯函数" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 保存记录读写 saves

**Files:**
- Create: `src/types/save.ts`、`src/data/saves.ts`
- Test: `tests/saves.test.ts`

**Interfaces:**
- Consumes: `AvatarState`、`createEmptyState` (Task 3)，`Manifest` (Task 2)，`idb-keyval` 的 `get/set`。
- Produces:
  - `interface SaveRecord { id; name; createdAt; manifestVersion; baseId; parts: Record<string, string[]>; variants: Record<string, string>; thumbnail: string }`（设计文档里写的 `string | string[]` 在此统一为 `string[]`，与 `AvatarState.equipped` 一致）
  - `SAVES_KEY = 'saves'`、`MAX_SAVES = 50`、`class SavesFullError`
  - `listSaves(): Promise<SaveRecord[]>`、`addSave(record): Promise<SaveRecord[]>`（新记录排最前，满 50 抛 `SavesFullError`）、`deleteSave(id): Promise<SaveRecord[]>`
  - `toSaveRecord(state, name, thumbnail, manifestVersion, now?): SaveRecord`
  - `fromSaveRecord(record, manifest): { state: AvatarState; skipped: string[] }`

- [ ] **Step 1: 写类型**

`src/types/save.ts`:
```ts
export interface SaveRecord {
  id: string
  name: string
  /** ISO 时间 */
  createdAt: string
  manifestVersion: number
  baseId: string
  /** slotId -> partId[] */
  parts: Record<string, string[]>
  /** partId -> variantId */
  variants: Record<string, string>
  /** data:image/jpeg;base64,… */
  thumbnail: string
}
```

- [ ] **Step 2: 写失败的测试**

`tests/saves.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
}))

import {
  MAX_SAVES, SavesFullError, addSave, deleteSave, fromSaveRecord, listSaves, toSaveRecord,
} from '@/data/saves'
import { createEmptyState, equipPart, setVariant } from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()

function dressed() {
  let s = createEmptyState(m, 'female_regular')
  s = equipPart(s, part(m, 'ranger_body'), m)
  s = equipPart(s, part(m, 'hair_f'), m)
  s = equipPart(s, part(m, 'hood'), m)
  s = equipPart(s, part(m, 'pauldron'), m)
  s = setVariant(s, 'ranger_body', 'b')
  return s
}

beforeEach(() => store.clear())

describe('listSaves / addSave / deleteSave', () => {
  it('初始为空', async () => {
    expect(await listSaves()).toEqual([])
  })

  it('新增后排在最前，删除后消失', async () => {
    const a = toSaveRecord(dressed(), 'A', 'data:a', 1, new Date('2026-10-08T00:00:00Z'))
    const b = toSaveRecord(dressed(), 'B', 'data:b', 1, new Date('2026-10-08T00:01:00Z'))
    await addSave(a)
    const list = await addSave(b)
    expect(list.map((r) => r.name)).toEqual(['B', 'A'])
    const after = await deleteSave(a.id)
    expect(after.map((r) => r.name)).toEqual(['B'])
  })

  it(`超过 ${MAX_SAVES} 条时抛 SavesFullError`, async () => {
    for (let i = 0; i < MAX_SAVES; i++) await addSave(toSaveRecord(dressed(), `S${i}`, '', 1))
    await expect(addSave(toSaveRecord(dressed(), 'overflow', '', 1))).rejects.toBeInstanceOf(SavesFullError)
  })
})

describe('toSaveRecord / fromSaveRecord', () => {
  it('往返后状态一致，包括多选槽位和变体', () => {
    const s = dressed()
    const rec = toSaveRecord(s, '我的游侠', 'data:x', 1, new Date('2026-10-08T00:00:00Z'))
    expect(rec.createdAt).toBe('2026-10-08T00:00:00.000Z')
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/)
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(skipped).toEqual([])
    expect(state).toEqual(s)
  })

  it('记录里的部件已不存在时跳过并报告', () => {
    const rec = toSaveRecord(dressed(), 'old', '', 1)
    const mm = makeManifest()
    mm.parts = mm.parts.filter((p) => p.id !== 'ranger_body' && p.id !== 'hood')
    const { state, skipped } = fromSaveRecord(rec, mm)
    expect(skipped.sort()).toEqual(['hood', 'ranger_body'])
    expect(state.equipped.body).toEqual([])
    expect(state.equipped.accessory).toEqual(['pauldron'])
    expect(state.variants.ranger_body).toBeUndefined()
    expect(state.equipped.arms).toEqual(['ranger_arms'])
  })

  it('底模不存在时退回第一个底模并报告', () => {
    const rec = { ...toSaveRecord(dressed(), 'x', '', 1), baseId: 'ghost' }
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(state.baseId).toBe('female_regular')
    expect(skipped).toContain('ghost')
  })

  it('变体 id 已不存在时忽略该变体', () => {
    const rec = toSaveRecord(dressed(), 'x', '', 1)
    rec.variants.ranger_body = 'z'
    const { state } = fromSaveRecord(rec, m)
    expect(state.variants.ranger_body).toBeUndefined()
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/saves.test.ts`
Expected: FAIL，找不到模块 `@/data/saves`。

- [ ] **Step 4: 实现**

`src/data/saves.ts`:
```ts
import { get, set } from 'idb-keyval'
import type { Manifest } from '@/types/manifest'
import type { SaveRecord } from '@/types/save'
import { createEmptyState, type AvatarState } from '@/avatar/slotRules'

export const SAVES_KEY = 'saves'
export const MAX_SAVES = 50

export class SavesFullError extends Error {
  constructor() {
    super(`最多保存 ${MAX_SAVES} 个形象，请先删除一些`)
    this.name = 'SavesFullError'
  }
}

export async function listSaves(): Promise<SaveRecord[]> {
  const list = await get<SaveRecord[]>(SAVES_KEY)
  return Array.isArray(list) ? list : []
}

export async function addSave(record: SaveRecord): Promise<SaveRecord[]> {
  const list = await listSaves()
  if (list.length >= MAX_SAVES) throw new SavesFullError()
  const next = [record, ...list]
  await set(SAVES_KEY, next)
  return next
}

export async function deleteSave(id: string): Promise<SaveRecord[]> {
  const next = (await listSaves()).filter((r) => r.id !== id)
  await set(SAVES_KEY, next)
  return next
}

export function toSaveRecord(
  state: AvatarState,
  name: string,
  thumbnail: string,
  manifestVersion: number,
  now: Date = new Date(),
): SaveRecord {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now.toISOString(),
    manifestVersion,
    baseId: state.baseId,
    parts: Object.fromEntries(Object.entries(state.equipped).map(([k, v]) => [k, [...v]])),
    variants: { ...state.variants },
    thumbnail,
  }
}

export function fromSaveRecord(
  record: SaveRecord,
  manifest: Manifest,
): { state: AvatarState; skipped: string[] } {
  const skipped: string[] = []
  const base = manifest.bases.find((b) => b.id === record.baseId) ?? manifest.bases[0]
  if (base.id !== record.baseId) skipped.push(record.baseId)
  const state = createEmptyState(manifest, base.id)
  for (const [slotId, ids] of Object.entries(record.parts)) {
    const target = state.equipped[slotId]
    if (!target) {
      skipped.push(...ids)
      continue
    }
    for (const id of ids) {
      const p = manifest.parts.find((x) => x.id === id && x.slot === slotId)
      if (p) target.push(id)
      else skipped.push(id)
    }
  }
  const equippedIds = new Set(Object.values(state.equipped).flat())
  for (const [partId, variantId] of Object.entries(record.variants)) {
    const p = manifest.parts.find((x) => x.id === partId)
    if (p && equippedIds.has(partId) && p.variants.some((v) => v.id === variantId)) {
      state.variants[partId] = variantId
    }
  }
  return { state, skipped }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/saves.test.ts && npm run typecheck`
Expected: 7 个测试 PASS。

- [ ] **Step 6: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 保存记录读写与恢复" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 资产脚本 build-manifest

**Files:**
- Create: `scripts/lib/classify.mjs`、`scripts/manifest.config.mjs`、`scripts/build-manifest.mjs`
- Test: `tests/classify.test.mjs`

**Interfaces:**
- Consumes: `assets-src/` 目录（可为空，脚本会提示），`fast-glob`、`@gltf-transform/*`。
- Produces: `public/avatar/manifest.json` 符合 Task 2 的 `Manifest` 类型；模型写成单文件 glb 到 `public/avatar/models/...`，贴图到 `textures/<set>/`，动画到 `anim/`。
- `classify.mjs` 导出：`slugify(s)`、`baseName(rel)`、`detectSex(rel)`、`detectSet(rel)`、`labelFromFile(rel)`、`classifyFiles(files, rules, { setLabels, slotLabels })`、`buildPresets(parts, outfitSlotIds, setLabels)`、`chooseAnimation(candidates)`。
- 说明：设计文档里 `--optimize` 的「贴图缩到 1024」需要额外安装 `sharp`，本任务的 `--optimize` 只做 `dedup + prune + resample`，README 里注明。

- [ ] **Step 1: 写失败的测试**

`tests/classify.test.mjs`:
```js
import { describe, expect, it } from 'vitest'
import {
  buildPresets, chooseAnimation, classifyFiles, detectSet, detectSex, slugify,
} from '../scripts/lib/classify.mjs'
import { rules, setLabels, slotLabels, slots } from '../scripts/manifest.config.mjs'

const files = [
  'base/Characters/Female_Regular.gltf',
  'base/Characters/Male_Superhero.gltf',
  'base/Hair/Hair_01.gltf',
  'base/Eyebrows/Eyebrows_Female.gltf',
  'outfits/Ranger/Ranger_Body.gltf',
  'outfits/Ranger/Ranger_Arms.gltf',
  'outfits/Ranger/Ranger_Legs.gltf',
  'outfits/Ranger/Ranger_Feet.gltf',
  'outfits/Ranger/Ranger_Hood.gltf',
  'outfits/Peasant/Peasant_Body.gltf',
  'anim/Universal_Animation_Library.gltf',
  'misc/Thing.gltf',
]

describe('helpers', () => {
  it('slugify', () => expect(slugify('Ranger Body-01.glb')).toBe('ranger_body_01_glb'))
  it('detectSex 区分 Female 与 Male', () => {
    expect(detectSex('base/Characters/Female_Regular.gltf')).toBe('female')
    expect(detectSex('base/Characters/Male_Regular.gltf')).toBe('male')
    expect(detectSex('outfits/Ranger/Ranger_Body.gltf')).toBe('any')
  })
  it('detectSet 取 outfits 下的文件夹名', () => {
    expect(detectSet('outfits/Ranger/Ranger_Body.gltf')).toBe('ranger')
    expect(detectSet('outfits/Peasant/Sub/Peasant_Body.gltf')).toBe('sub')
  })
})

describe('classifyFiles', () => {
  const r = classifyFiles(files, rules, { setLabels, slotLabels })

  it('底模', () => {
    expect(r.bases.map((b) => [b.id, b.sex])).toEqual([
      ['female_regular', 'female'],
      ['male_superhero', 'male'],
    ])
    expect(r.bases[0].url).toBe('models/base/female_regular.glb')
  })

  it('头部槽位没有 set', () => {
    const hair = r.parts.find((p) => p.id === 'hair_01')
    expect(hair.slot).toBe('hair')
    expect(hair.set).toBeNull()
    const brows = r.parts.find((p) => p.id === 'eyebrows_female')
    expect(brows.slot).toBe('eyebrows')
    expect(brows.sex).toBe('female')
  })

  it('服装按文件名归槽位，兜帽落到配饰，带套装中文名', () => {
    const bySlot = Object.fromEntries(r.parts.filter((p) => p.set === 'ranger').map((p) => [p.slot, p]))
    expect(Object.keys(bySlot).sort()).toEqual(['accessory', 'arms', 'body', 'feet', 'legs'])
    expect(bySlot.body.label).toBe('游侠 上身')
    expect(bySlot.body.url).toBe('models/outfits/ranger/ranger_body.glb')
    expect(bySlot.accessory.id).toBe('ranger_hood')
  })

  it('动画与未匹配文件', () => {
    expect(r.animations.map((a) => a.id)).toEqual(['universal_animation_library'])
    expect(r.unmatched).toEqual(['misc/Thing.gltf'])
  })
})

describe('buildPresets', () => {
  it('只有四个服装槽位齐全的套装才生成预设', () => {
    const r = classifyFiles(files, rules, { setLabels, slotLabels })
    const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
    const presets = buildPresets(r.parts, outfitSlotIds, setLabels)
    expect(presets).toEqual([
      { id: 'ranger', label: '游侠', parts: { body: 'ranger_body', arms: 'ranger_arms', legs: 'ranger_legs', feet: 'ranger_feet' } },
    ])
  })
})

describe('chooseAnimation', () => {
  it('优先选有 idle 剪辑的文件，否则取第一个文件的第一个剪辑', () => {
    expect(chooseAnimation([
      { id: 'a', clips: ['Run', 'Walk'] },
      { id: 'b', clips: ['Jump', 'Idle_Loop'] },
    ])).toEqual({ id: 'b', clip: 'Idle_Loop' })
    expect(chooseAnimation([{ id: 'a', clips: ['Run'] }])).toEqual({ id: 'a', clip: 'Run' })
    expect(chooseAnimation([{ id: 'a', clips: [] }])).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/classify.test.mjs`
Expected: FAIL，找不到 `scripts/lib/classify.mjs`。

- [ ] **Step 3: 写 classify.mjs**

`scripts/lib/classify.mjs`:
```js
/**
 * @typedef {{ test: RegExp, kind: 'base' | 'part' | 'animation', slot?: string }} Rule
 */

/** @param {string} s */
export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** @param {string} rel */
export function baseName(rel) {
  const file = rel.split('/').pop() ?? rel
  return file.replace(/\.(glb|gltf)$/i, '')
}

/** @param {string} rel @returns {'male'|'female'|'any'} */
export function detectSex(rel) {
  const name = baseName(rel)
  if (/female/i.test(name)) return 'female'
  if (/male/i.test(name)) return 'male'
  return 'any'
}

/** outfits/<Set>/.../x.gltf 取 x 的直接父文件夹名；其他取文件名第一段 */
export function detectSet(rel) {
  const segs = rel.split('/')
  if (segs[0] === 'outfits' && segs.length >= 3) return slugify(segs[segs.length - 2])
  const first = baseName(rel).split(/[_\-\s]/)[0]
  return first ? slugify(first) : null
}

/** @param {string} rel */
export function labelFromFile(rel) {
  return baseName(rel).replace(/[_\-]+/g, ' ').trim()
}

/**
 * @param {string[]} files 相对 assets-src 的路径，正斜杠
 * @param {Rule[]} rules 按顺序匹配，第一条命中生效
 * @param {{ setLabels?: Record<string,string>, slotLabels?: Record<string,string> }} [opts]
 */
export function classifyFiles(files, rules, opts = {}) {
  const setLabels = opts.setLabels ?? {}
  const slotLabels = opts.slotLabels ?? {}
  const out = { bases: [], parts: [], animations: [], unmatched: [] }
  for (const rel of files) {
    const rule = rules.find((r) => r.test.test(rel))
    if (!rule) {
      out.unmatched.push(rel)
      continue
    }
    const slug = slugify(baseName(rel))
    if (rule.kind === 'base') {
      out.bases.push({
        id: slug, sex: detectSex(rel), label: labelFromFile(rel), src: rel,
        url: `models/base/${slug}.glb`, bodyMeshes: [], headMeshes: [],
      })
    } else if (rule.kind === 'animation') {
      out.animations.push({ id: slug, label: labelFromFile(rel), src: rel, url: `anim/${slug}.glb`, clip: '' })
    } else {
      const slot = rule.slot ?? 'accessory'
      const headSlot = slot === 'hair' || slot === 'eyebrows'
      const set = headSlot ? null : detectSet(rel)
      const id = set && !slug.startsWith(set) ? `${set}_${slug}` : slug
      const dir = set ? `models/outfits/${set}` : `models/${slot}`
      const label = set && setLabels[set] ? `${setLabels[set]} ${slotLabels[slot] ?? slot}` : labelFromFile(rel)
      out.parts.push({ id, slot, set, label, sex: detectSex(rel), src: rel, url: `${dir}/${id}.glb`, variants: [] })
    }
  }
  return out
}

/**
 * @param {{ id: string, slot: string, set: string | null }[]} parts
 * @param {string[]} outfitSlotIds
 * @param {Record<string,string>} [setLabels]
 */
export function buildPresets(parts, outfitSlotIds, setLabels = {}) {
  /** @type {Map<string, Record<string,string>>} */
  const bySet = new Map()
  for (const p of parts) {
    if (!p.set || !outfitSlotIds.includes(p.slot)) continue
    if (!bySet.has(p.set)) bySet.set(p.set, {})
    const slotsOfSet = bySet.get(p.set)
    if (!slotsOfSet[p.slot]) slotsOfSet[p.slot] = p.id
  }
  const presets = []
  for (const [set, slotsOfSet] of bySet) {
    if (outfitSlotIds.every((s) => slotsOfSet[s])) {
      presets.push({ id: set, label: setLabels[set] ?? set, parts: slotsOfSet })
    }
  }
  return presets
}

/**
 * @param {{ id: string, clips: string[] }[]} candidates
 * @returns {{ id: string, clip: string } | null}
 */
export function chooseAnimation(candidates) {
  for (const c of candidates) {
    const idle = c.clips.find((n) => /idle/i.test(n))
    if (idle) return { id: c.id, clip: idle }
  }
  const first = candidates.find((c) => c.clips.length > 0)
  return first ? { id: first.id, clip: first.clips[0] } : null
}
```

- [ ] **Step 4: 写 manifest.config.mjs**

```js
// 解压素材后先运行 `npm run assets:scan`，对照输出调整这里的 rules 与 variantFor。
import { slugify } from './lib/classify.mjs'

export const skeleton = { rootBone: 'root', expectedBones: 65 }

export const slots = [
  { id: 'hair', label: '发型', group: 'head', multiple: false, outfit: false },
  { id: 'eyebrows', label: '眉毛', group: 'head', multiple: false, outfit: false },
  { id: 'body', label: '上身', group: 'outfit', multiple: false, outfit: true },
  { id: 'arms', label: '手臂', group: 'outfit', multiple: false, outfit: true },
  { id: 'legs', label: '腿部', group: 'outfit', multiple: false, outfit: true },
  { id: 'feet', label: '鞋靴', group: 'outfit', multiple: false, outfit: true },
  { id: 'accessory', label: '配饰', group: 'outfit', multiple: true, outfit: false },
]

export const slotLabels = Object.fromEntries(slots.map((s) => [s.id, s.label]))

export const setLabels = {
  ranger: '游侠', peasant: '农夫', knight: '骑士', noble: '贵族', wizard: '法师',
  mage: '法师', rogue: '盗贼', priest: '牧师', barbarian: '野蛮人', archer: '弓手',
  merchant: '商人', king: '国王', queen: '女王', druid: '德鲁伊',
}

/** 按顺序匹配，第一条命中生效。头部规则必须排在底模规则前面。 */
export const rules = [
  { test: /^base\/.*(eyebrow|brow)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'eyebrows' },
  { test: /^base\/.*hair\w*\.(glb|gltf)$/i, kind: 'part', slot: 'hair' },
  { test: /^base\/.*(male|female)\w*\.(glb|gltf)$/i, kind: 'base' },
  { test: /^outfits\/.*(body|torso|chest|shirt|robe)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'body' },
  { test: /^outfits\/.*(arm|arms|sleeve|glove|bracer)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'arms' },
  { test: /^outfits\/.*(leg|legs|pants|trousers|skirt)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'legs' },
  { test: /^outfits\/.*(feet|foot|boot|boots|shoe|shoes)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'feet' },
  { test: /^outfits\/.*\.(glb|gltf)$/i, kind: 'part', slot: 'accessory' },
  { test: /^anim\/.*\.(glb|gltf)$/i, kind: 'animation' },
]

/**
 * 贴图变体识别。返回 null 表示这张 PNG 不是服装变体贴图。
 * 默认假设路径形如 outfits/Ranger/Textures/Ranger_B.png：套装名 + 分隔符 + 变体标记。
 * @param {string} pngRel
 * @returns {{ set: string, variantId: string, label: string } | null}
 */
export function variantFor(pngRel) {
  const m = /^outfits\/(?:[^/]+\/)*([A-Za-z]+)[_-]([A-Za-z0-9]{1,3})\.png$/i.exec(pngRel)
  if (!m) return null
  return { set: slugify(m[1]), variantId: m[2].toLowerCase(), label: m[2].toUpperCase() }
}
```

- [ ] **Step 5: 写 build-manifest.mjs**

```js
#!/usr/bin/env node
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample } from '@gltf-transform/functions'
import { buildPresets, chooseAnimation, classifyFiles } from './lib/classify.mjs'
import { rules, setLabels, skeleton, slotLabels, slots, variantFor } from './manifest.config.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'assets-src')
const OUT = path.join(ROOT, 'public', 'avatar')
const args = new Set(process.argv.slice(2))
const SCAN = args.has('--scan')
const OPTIMIZE = args.has('--optimize')
const HEAD_RE = /head|eye|teeth|tongue|brow|lash|mouth/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

/** @param {string} abs */
async function inspect(abs) {
  const doc = await io.read(abs)
  const root = doc.getRoot()
  const meshNames = root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName() || n.getMesh().getName())
  const joints = root.listSkins().reduce((m, s) => Math.max(m, s.listJoints().length), 0)
  const clips = root.listAnimations().map((a) => a.getName())
  return { doc, meshNames, joints, clips }
}

/** @param {import('@gltf-transform/core').Document} doc @param {string} relUrl */
async function writeGlb(doc, relUrl) {
  if (OPTIMIZE) await doc.transform(dedup(), prune(), resample())
  const dest = path.join(OUT, relUrl)
  await mkdir(path.dirname(dest), { recursive: true })
  await io.write(dest, doc)
}

async function main() {
  const models = (await fg(['**/*.{glb,gltf}'], { cwd: SRC, onlyFiles: true })).sort()
  const pngs = (await fg(['**/*.png'], { cwd: SRC, onlyFiles: true })).sort()
  if (!models.length) {
    console.error('assets-src 下没有 glb/gltf 文件。请先按 docs/ASSETS.md 下载并解压素材。')
    process.exit(1)
  }
  const cls = classifyFiles(models, rules, { setLabels, slotLabels })
  const kindOf = (rel) =>
    cls.bases.some((b) => b.src === rel) ? '底模'
    : cls.animations.some((a) => a.src === rel) ? '动画'
    : (cls.parts.find((p) => p.src === rel)?.slot ?? '未匹配')

  if (SCAN) {
    for (const rel of models) {
      const { meshNames, joints, clips } = await inspect(path.join(SRC, rel))
      console.log(`${rel}\n  归类: ${kindOf(rel)}  骨骼: ${joints}  网格: ${meshNames.join(', ') || '(无)'}${clips.length ? `\n  动画: ${clips.join(', ')}` : ''}`)
    }
    console.log('\nPNG 贴图:')
    for (const p of pngs) console.log(`  ${p}  -> ${JSON.stringify(variantFor(p))}`)
    return
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const warnings = []

  for (const b of cls.bases) {
    const { doc, meshNames, joints } = await inspect(path.join(SRC, b.src))
    if (joints !== skeleton.expectedBones) warnings.push(`${b.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    b.headMeshes = meshNames.filter((n) => HEAD_RE.test(n))
    b.bodyMeshes = meshNames.filter((n) => !HEAD_RE.test(n))
    if (b.sex === 'any') {
      warnings.push(`${b.src} 文件名没有 Male/Female，默认为 female`)
      b.sex = 'female'
    }
    await writeGlb(doc, b.url)
    delete b.src
  }

  for (const p of cls.parts) {
    const { doc, joints } = await inspect(path.join(SRC, p.src))
    if (joints && joints !== skeleton.expectedBones) warnings.push(`${p.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    await writeGlb(doc, p.url)
    delete p.src
  }

  /** @type {Map<string, {id:string,label:string,textures:{map:string}}[]>} */
  const variantsBySet = new Map()
  for (const png of pngs) {
    const v = variantFor(png)
    if (!v) continue
    const url = `textures/${v.set}/${v.set}_${v.variantId}.png`
    const dest = path.join(OUT, url)
    await mkdir(path.dirname(dest), { recursive: true })
    await copyFile(path.join(SRC, png), dest)
    if (!variantsBySet.has(v.set)) variantsBySet.set(v.set, [])
    variantsBySet.get(v.set).push({ id: v.variantId, label: v.label, textures: { map: url } })
  }
  for (const p of cls.parts) {
    if (p.set && variantsBySet.has(p.set)) p.variants = variantsBySet.get(p.set)
  }

  const candidates = []
  for (const a of cls.animations) {
    const { doc, clips } = await inspect(path.join(SRC, a.src))
    candidates.push({ id: a.id, clips, doc, ref: a })
  }
  const chosen = chooseAnimation(candidates)
  const animations = []
  if (chosen) {
    const c = candidates.find((x) => x.id === chosen.id)
    c.ref.clip = chosen.clip
    c.ref.label = '待机'
    await writeGlb(c.doc, c.ref.url)
    delete c.ref.src
    animations.push(c.ref)
  } else if (cls.animations.length) {
    warnings.push('动画文件里没有任何剪辑')
  }

  const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
  const manifest = {
    version: 1, skeleton, bases: cls.bases, slots, parts: cls.parts,
    presets: buildPresets(cls.parts, outfitSlotIds, setLabels), animations,
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  for (const s of slots) console.log(`${s.label}(${s.id}): ${cls.parts.filter((p) => p.slot === s.id).length}`)
  console.log(`底模 ${cls.bases.length}，预设 ${manifest.presets.length}，动画 ${animations.length}`)
  if (cls.unmatched.length) console.log(`未匹配 ${cls.unmatched.length} 个文件:\n  ${cls.unmatched.join('\n  ')}`)
  for (const w of warnings) console.warn(`警告: ${w}`)
  console.log(`已写入 ${path.relative(ROOT, path.join(OUT, 'manifest.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 6: 运行测试确认通过，并在空目录下验证脚本提示**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/classify.test.mjs && node scripts/build-manifest.mjs --scan; echo "exit=$?"`
Expected: 测试 PASS；若 `assets-src/` 还是空的，脚本打印「assets-src 下没有 glb/gltf 文件」并 exit=1。若素材已到位，打印每个文件的归类、骨骼数和网格名，exit=0。

- [ ] **Step 7: 若素材已到位，对照 scan 输出调整规则并生成**

检查 scan 输出里每个文件的「归类」是否正确、PNG 的 `variantFor` 结果是否合理。不对就改 `scripts/manifest.config.mjs` 的 `rules` 或 `variantFor`，再跑一次 scan。然后：

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run assets:build`
Expected: 每个槽位的数量、底模数、预设数、动画数被打印；`public/avatar/manifest.json` 存在。

然后加一个长期保留的测试，文件不存在时自动跳过：

`tests/realManifest.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateManifest } from '@/data/manifest'

const file = fileURLToPath(new URL('../public/avatar/manifest.json', import.meta.url))

describe.skipIf(!existsSync(file))('真实 manifest.json', () => {
  it('通过校验，且每个服装槽位至少有一个部件', () => {
    const m = validateManifest(JSON.parse(readFileSync(file, 'utf8')))
    for (const slot of m.slots.filter((s) => s.outfit)) {
      expect(m.parts.some((p) => p.slot === slot.id), `槽位 ${slot.id} 没有部件`).toBe(true)
    }
  })
})
```

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/realManifest.test.ts`
Expected: 素材已到位时 PASS；否则显示 skipped。素材还没到位则在 Task 10 Step 1 回来补做本步。

- [ ] **Step 8: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 素材扫描与 manifest 生成脚本" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 骨骼重绑、部件加载缓存、AvatarRig

**Files:**
- Create: `src/avatar/rebind.ts`、`src/avatar/PartLoader.ts`、`src/avatar/AvatarRig.ts`
- Test: `tests/fixtures/rig.ts`、`tests/rebind.test.ts`、`tests/avatarRig.test.ts`

**Interfaces:**
- Consumes: Task 2 的类型。three 核心类在 Node 里可直接构造，所以这些测试不需要浏览器。
- Produces:
  - `collectSkinnedMeshes(root): SkinnedMesh[]`、`buildBoneMap(skeleton): Map<string, Bone>`、`rebindToSkeleton(mesh, boneByName): string[]`（返回缺失骨骼名，空数组即成功）
  - `interface LoadedGltf { scene: Object3D; animations: AnimationClip[] }`、`interface GltfSource { load(url): Promise<LoadedGltf> }`、`class PartLoader implements GltfSource`（`load/has/clear`）
  - `class PartBindError extends Error { partId; missing }`
  - `class AvatarRig`：`root: Group`、`setBase(base)`、`equip(part)`、`unequip(partId)`、`isEquipped(id)`、`equippedIds`、`setBodyVisible(v)`、`bodyVisible`、`setVariant(part, variant | null)`、`playAnimation(anim)`、`stopAnimation()`、`update(delta)`、`getBounds()`、`getHeadWorldPosition()`、`getBone(name)`、`hasBase`、`boneCount`。构造函数 `(source: GltfSource, resolveUrl: (p: string) => string)`。
- 与设计文档的差异：几何体与原始贴图由 PartLoader 缓存共享，卸下部件时只释放克隆出来的材质和变体贴图，不释放几何体。

- [ ] **Step 1: 写骨骼夹具与 rebind 测试**

`tests/fixtures/rig.ts`:
```ts
import { Bone, BufferGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from 'three'

/** 造一条链状骨骼和一个绑定其上的 SkinnedMesh，模拟 glTF 场景 */
export function makeRig(boneNames: string[], meshName = 'Body') {
  const bones = boneNames.map((n) => {
    const b = new Bone()
    b.name = n
    return b
  })
  for (let i = 1; i < bones.length; i++) bones[i - 1].add(bones[i])
  const root = new Group()
  root.add(bones[0])
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshStandardMaterial())
  mesh.name = meshName
  root.add(mesh)
  root.updateMatrixWorld(true)
  mesh.bind(new Skeleton(bones))
  return { root, mesh, bones }
}
```

`tests/rebind.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildBoneMap, collectSkinnedMeshes, rebindToSkeleton } from '@/avatar/rebind'
import { makeRig } from './fixtures/rig'

describe('collectSkinnedMeshes / buildBoneMap', () => {
  it('找到蒙皮网格并按名字建骨骼表', () => {
    const { root, mesh } = makeRig(['root', 'spine', 'head'])
    expect(collectSkinnedMeshes(root)).toEqual([mesh])
    const map = buildBoneMap(mesh.skeleton)
    expect([...map.keys()]).toEqual(['root', 'spine', 'head'])
  })
})

describe('rebindToSkeleton', () => {
  it('骨骼名全部匹配时绑定到目标骨骼并返回空数组', () => {
    const target = makeRig(['root', 'spine', 'head'])
    const partRig = makeRig(['root', 'spine', 'head'], 'Shirt')
    const missing = rebindToSkeleton(partRig.mesh, buildBoneMap(target.mesh.skeleton))
    expect(missing).toEqual([])
    expect(partRig.mesh.skeleton.bones[1]).toBe(target.bones[1])
    expect(partRig.mesh.frustumCulled).toBe(false)
  })

  it('缺骨骼时返回缺失名并保持原骨骼不变', () => {
    const target = makeRig(['root', 'spine', 'head'])
    const partRig = makeRig(['root', 'spine', 'tail'], 'Shirt')
    const before = partRig.mesh.skeleton
    const missing = rebindToSkeleton(partRig.mesh, buildBoneMap(target.mesh.skeleton))
    expect(missing).toEqual(['tail'])
    expect(partRig.mesh.skeleton).toBe(before)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/rebind.test.ts`
Expected: FAIL，找不到 `@/avatar/rebind`。

- [ ] **Step 3: 实现 rebind.ts 与 PartLoader.ts**

`src/avatar/rebind.ts`:
```ts
import { Bone, Matrix4, type Object3D, Skeleton, type SkinnedMesh } from 'three'

export function collectSkinnedMeshes(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = []
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) out.push(o as SkinnedMesh)
  })
  return out
}

export function buildBoneMap(skeleton: Skeleton): Map<string, Bone> {
  const map = new Map<string, Bone>()
  for (const b of skeleton.bones) if (!map.has(b.name)) map.set(b.name, b)
  return map
}

/**
 * 把 mesh 的骨骼按名字替换成目标骨骼。
 * 返回缺失的骨骼名；空数组表示成功，此时 mesh 已经绑定到目标骨骼。
 * 绑定矩阵用单位矩阵：部件网格直接挂在角色根节点下，自身不带变换。
 */
export function rebindToSkeleton(mesh: SkinnedMesh, boneByName: Map<string, Bone>): string[] {
  const missing: string[] = []
  const bones: Bone[] = []
  for (const b of mesh.skeleton.bones) {
    const target = boneByName.get(b.name)
    if (target) bones.push(target)
    else missing.push(b.name)
  }
  if (missing.length) return missing
  const inverses = mesh.skeleton.boneInverses.map((m) => m.clone())
  mesh.bind(new Skeleton(bones, inverses), new Matrix4())
  mesh.frustumCulled = false
  return []
}
```

`src/avatar/PartLoader.ts`:
```ts
import type { AnimationClip, Object3D } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

export interface LoadedGltf {
  scene: Object3D
  animations: AnimationClip[]
}

export interface GltfSource {
  load(url: string): Promise<LoadedGltf>
}

/** GLTFLoader 封装：同一 URL 只请求一次，失败后允许重试 */
export class PartLoader implements GltfSource {
  private readonly cache = new Map<string, Promise<GLTF>>()
  private readonly loader = new GLTFLoader()

  load(url: string): Promise<GLTF> {
    let p = this.cache.get(url)
    if (!p) {
      p = this.loader.loadAsync(url).catch((err: unknown) => {
        this.cache.delete(url)
        throw err
      })
      this.cache.set(url, p)
    }
    return p
  }

  has(url: string): boolean {
    return this.cache.has(url)
  }

  clear(): void {
    this.cache.clear()
  }
}
```

- [ ] **Step 4: 运行 rebind 测试确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/rebind.test.ts`
Expected: 3 个 PASS。

- [ ] **Step 5: 写 AvatarRig 测试**

`tests/avatarRig.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { SkinnedMesh } from 'three'
import { AvatarRig, PartBindError } from '@/avatar/AvatarRig'
import type { GltfSource, LoadedGltf } from '@/avatar/PartLoader'
import { collectSkinnedMeshes } from '@/avatar/rebind'
import { makeManifest, part } from './fixtures/manifest'
import { makeRig } from './fixtures/rig'

const BONES = ['root', 'pelvis', 'spine', 'head']
const m = makeManifest()
const female = m.bases[0]
const male = m.bases[1]
const url = (p: string) => `/avatar/${p}`

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeSource implements GltfSource {
  files = new Map<string, LoadedGltf>()
  gates = new Map<string, Promise<void>>()
  calls: string[] = []
  async load(u: string): Promise<LoadedGltf> {
    this.calls.push(u)
    await this.gates.get(u)
    const f = this.files.get(u)
    if (!f) throw new Error(`404 ${u}`)
    return f
  }
}

function setup() {
  const src = new FakeSource()
  src.files.set(url(female.url), { scene: makeRig(BONES, 'Body').root, animations: [] })
  src.files.set(url(male.url), { scene: makeRig(BONES, 'Body').root, animations: [] })
  for (const p of m.parts) src.files.set(url(p.url), { scene: makeRig(BONES, p.id).root, animations: [] })
  src.files.set(url('models/bad.glb'), { scene: makeRig(['root', 'pelvis', 'tail'], 'bad').root, animations: [] })
  const rig = new AvatarRig(src, url)
  return { src, rig }
}

function partMeshes(rig: AvatarRig): SkinnedMesh[] {
  return collectSkinnedMeshes(rig.root).filter((x) => x.name !== 'Body')
}

describe('AvatarRig', () => {
  it('setBase 后有骨骼、底模身体可见', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    expect(rig.hasBase).toBe(true)
    expect(rig.boneCount).toBe(4)
    expect(rig.bodyVisible).toBe(true)
    expect(rig.getBone('head')?.name).toBe('head')
  })

  it('没有底模时 equip 报错', async () => {
    const { rig } = setup()
    await expect(rig.equip(part(m, 'ranger_body'))).rejects.toThrow('先设置底模')
  })

  it('equip 把部件网格绑到底模骨骼并挂到 root，unequip 后移除', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'ranger_body'))
    expect(rig.isEquipped('ranger_body')).toBe(true)
    const meshes = partMeshes(rig)
    expect(meshes.map((x) => x.name)).toEqual(['ranger_body'])
    expect(meshes[0].skeleton.bones[0]).toBe(rig.getBone('root'))
    rig.unequip('ranger_body')
    expect(rig.isEquipped('ranger_body')).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('重复 equip 同一部件只加载一次', async () => {
    const { rig, src } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'hood'))
    await rig.equip(part(m, 'hood'))
    expect(src.calls.filter((c) => c === url(part(m, 'hood').url))).toHaveLength(1)
    expect(partMeshes(rig)).toHaveLength(1)
  })

  it('缺骨骼的部件抛 PartBindError 且不挂到场景', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    const bad = { ...part(m, 'pauldron'), id: 'bad', url: 'models/bad.glb' }
    await expect(rig.equip(bad)).rejects.toBeInstanceOf(PartBindError)
    await rig.equip(bad).catch((e: PartBindError) => expect(e.missing).toEqual(['tail']))
    expect(rig.isEquipped('bad')).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('加载完成前被卸下的部件不会挂回场景', async () => {
    const { rig, src } = setup()
    await rig.setBase(female)
    const gate = deferred()
    const p = part(m, 'ranger_body')
    src.gates.set(url(p.url), gate.promise)
    const equipping = rig.equip(p)
    rig.unequip(p.id)
    gate.resolve()
    await equipping
    expect(rig.isEquipped(p.id)).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('换底模会清掉所有部件并恢复身体可见', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'ranger_body'))
    rig.setBodyVisible(false)
    await rig.setBase(male)
    expect(rig.equippedIds).toEqual([])
    expect(rig.bodyVisible).toBe(true)
    expect(rig.boneCount).toBe(4)
  })

  it('setBodyVisible 只影响 bodyMeshes', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    rig.setBodyVisible(false)
    expect(rig.bodyVisible).toBe(false)
    rig.setBodyVisible(true)
    expect(rig.bodyVisible).toBe(true)
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/avatarRig.test.ts`
Expected: FAIL，找不到 `@/avatar/AvatarRig`。

- [ ] **Step 7: 实现 AvatarRig.ts**

```ts
import {
  AnimationClip, AnimationMixer, type Bone, Box3, Group, LoopRepeat, type Material,
  type Mesh, type MeshStandardMaterial, type Object3D, SRGBColorSpace, type Skeleton,
  type SkinnedMesh, type Texture, TextureLoader, Vector3,
} from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import type { AnimationRef, BaseModel, Part, Variant } from '@/types/manifest'
import type { GltfSource, LoadedGltf } from './PartLoader'
import { buildBoneMap, collectSkinnedMeshes, rebindToSkeleton } from './rebind'

export class PartBindError extends Error {
  constructor(
    public readonly partId: string,
    public readonly missing: string[],
  ) {
    super(`部件 ${partId} 缺少骨骼：${missing.slice(0, 3).join('、')}${missing.length > 3 ? ' 等' : ''}`)
    this.name = 'PartBindError'
  }
}

interface EquippedPart {
  meshes: SkinnedMesh[]
  originalMaps: Map<SkinnedMesh, Texture | null>
  variantTexture: Texture | null
}

export class AvatarRig {
  readonly root = new Group()
  private skeleton: Skeleton | null = null
  private boneByName = new Map<string, Bone>()
  private baseScene: Object3D | null = null
  private bodyMeshes: Mesh[] = []
  private readonly equipped = new Map<string, EquippedPart>()
  private readonly pending = new Set<string>()
  private mixer: AnimationMixer | null = null
  private readonly textureLoader = new TextureLoader()
  private baseToken = 0

  constructor(
    private readonly source: GltfSource,
    private readonly resolveUrl: (p: string) => string,
  ) {
    this.root.name = 'avatar'
  }

  get hasBase(): boolean {
    return this.skeleton !== null
  }
  get boneCount(): number {
    return this.skeleton?.bones.length ?? 0
  }
  get equippedIds(): string[] {
    return [...this.equipped.keys()]
  }
  get bodyVisible(): boolean {
    return this.bodyMeshes.every((m) => m.visible)
  }
  getBone(name: string): Bone | undefined {
    return this.boneByName.get(name)
  }
  isEquipped(partId: string): boolean {
    return this.equipped.has(partId)
  }

  async setBase(base: BaseModel): Promise<void> {
    const token = ++this.baseToken
    const gltf = await this.source.load(this.resolveUrl(base.url))
    if (token !== this.baseToken) return
    this.clearAll()
    const scene = SkeletonUtils.clone(gltf.scene)
    const skinned = collectSkinnedMeshes(scene)
    if (!skinned.length) throw new Error(`底模 ${base.id} 没有蒙皮网格`)
    this.skeleton = skinned[0].skeleton
    this.boneByName = buildBoneMap(this.skeleton)
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      mesh.castShadow = true
      if (base.bodyMeshes.includes(mesh.name) && !base.headMeshes.includes(mesh.name)) {
        this.bodyMeshes.push(mesh)
      }
    })
    this.baseScene = scene
    this.root.add(scene)
    this.mixer = new AnimationMixer(scene)
  }

  private clearAll(): void {
    for (const id of [...this.equipped.keys()]) this.unequip(id)
    this.pending.clear()
    if (this.baseScene) {
      this.root.remove(this.baseScene)
      this.baseScene = null
    }
    this.mixer?.stopAllAction()
    this.mixer = null
    this.skeleton = null
    this.boneByName = new Map()
    this.bodyMeshes = []
  }

  async equip(part: Part): Promise<void> {
    if (this.equipped.has(part.id) || this.pending.has(part.id)) return
    if (!this.skeleton) throw new Error('先设置底模再装部件')
    this.pending.add(part.id)
    let gltf: LoadedGltf
    try {
      gltf = await this.source.load(this.resolveUrl(part.url))
    } catch (e) {
      this.pending.delete(part.id)
      throw e
    }
    // 等待期间被卸下或换了底模
    if (!this.pending.has(part.id) || !this.skeleton) return
    this.pending.delete(part.id)
    const scene = SkeletonUtils.clone(gltf.scene)
    const meshes = collectSkinnedMeshes(scene)
    if (!meshes.length) throw new Error(`部件 ${part.id} 没有蒙皮网格`)
    for (const mesh of meshes) {
      const missing = rebindToSkeleton(mesh, this.boneByName)
      if (missing.length) throw new PartBindError(part.id, missing)
    }
    const originalMaps = new Map<SkinnedMesh, Texture | null>()
    for (const mesh of meshes) {
      const material = (mesh.material as Material).clone() as MeshStandardMaterial
      mesh.material = material
      originalMaps.set(mesh, material.map ?? null)
      mesh.castShadow = true
      this.root.add(mesh)
    }
    this.equipped.set(part.id, { meshes, originalMaps, variantTexture: null })
  }

  unequip(partId: string): void {
    this.pending.delete(partId)
    const entry = this.equipped.get(partId)
    if (!entry) return
    for (const mesh of entry.meshes) {
      this.root.remove(mesh)
      ;(mesh.material as Material).dispose()
    }
    entry.variantTexture?.dispose()
    this.equipped.delete(partId)
  }

  setBodyVisible(visible: boolean): void {
    for (const m of this.bodyMeshes) m.visible = visible
  }

  async setVariant(part: Part, variant: Variant | null): Promise<void> {
    const entry = this.equipped.get(part.id)
    if (!entry) return
    if (!variant) {
      for (const mesh of entry.meshes) {
        const mat = mesh.material as MeshStandardMaterial
        mat.map = entry.originalMaps.get(mesh) ?? null
        mat.needsUpdate = true
      }
      entry.variantTexture?.dispose()
      entry.variantTexture = null
      return
    }
    const tex = await this.textureLoader.loadAsync(this.resolveUrl(variant.textures.map))
    tex.colorSpace = SRGBColorSpace
    tex.flipY = false
    if (this.equipped.get(part.id) !== entry) {
      tex.dispose()
      return
    }
    for (const mesh of entry.meshes) {
      const mat = mesh.material as MeshStandardMaterial
      mat.map = tex
      mat.needsUpdate = true
    }
    entry.variantTexture?.dispose()
    entry.variantTexture = tex
  }

  async playAnimation(anim: AnimationRef): Promise<void> {
    const mixer = this.mixer
    if (!mixer) return
    const gltf = await this.source.load(this.resolveUrl(anim.url))
    if (this.mixer !== mixer) return
    const clip: AnimationClip | undefined =
      AnimationClip.findByName(gltf.animations, anim.clip) ?? gltf.animations[0]
    if (!clip) throw new Error(`动画文件 ${anim.url} 没有剪辑`)
    mixer.stopAllAction()
    const action = mixer.clipAction(clip)
    action.setLoop(LoopRepeat, Infinity)
    action.play()
  }

  stopAnimation(): void {
    this.mixer?.stopAllAction()
  }

  update(delta: number): void {
    this.mixer?.update(delta)
  }

  getBounds(target = new Box3()): Box3 {
    target.makeEmpty()
    if (this.baseScene) target.setFromObject(this.baseScene, true)
    return target
  }

  getHeadWorldPosition(target = new Vector3()): Vector3 | null {
    const head =
      this.boneByName.get('head') ?? [...this.boneByName.values()].find((b) => /head/i.test(b.name))
    return head ? head.getWorldPosition(target) : null
  }
}
```

- [ ] **Step 8: 运行确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/rebind.test.ts tests/avatarRig.test.ts && npm run typecheck`
Expected: 11 个 PASS，typecheck 无错误。

- [ ] **Step 9: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 骨骼重绑、部件加载缓存与 AvatarRig" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: AvatarViewer 渲染器、相机、灯光、聚焦、截图

**Files:**
- Create: `src/avatar/AvatarViewer.ts`

**Interfaces:**
- Consumes: `AvatarRig`、`PartLoader` (Task 6)。
- Produces: `class AvatarViewer`，构造 `(container: HTMLElement, resolveUrl: (p: string) => string)`；方法 `on(event, fn)`、`setBase(base)`、`equip(part)`、`unequip(partId)`、`setBodyVisible(v)`、`setVariant(part, variant | null)`、`playAnimation(anim)`、`focus('head' | 'body')`、`applyBackgroundFromCss()`、`screenshot(width?, height?)`、`dispose()`；属性 `rig`、`loader`。事件 `loading(phase: 'start' | 'end', id)`、`error(id, reason)`。
- 浏览器验证放在 Task 10；本任务只要求类型检查通过。

- [ ] **Step 1: 实现**

`src/avatar/AvatarViewer.ts`:
```ts
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { AnimationRef, BaseModel, Part, Variant } from '@/types/manifest'
import { AvatarRig } from './AvatarRig'
import { PartLoader } from './PartLoader'

export type FocusTarget = 'head' | 'body'

export interface ViewerEvents {
  loading: (phase: 'start' | 'end', id: string) => void
  error: (id: string, reason: string) => void
}

const FOCUS_SECONDS = 0.4

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export class AvatarViewer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  readonly loader = new PartLoader()
  readonly rig: AvatarRig

  private readonly clock = new THREE.Clock()
  private raf = 0
  private readonly resizeObserver: ResizeObserver
  private readonly listeners: Partial<ViewerEvents> = {}

  private focusT = 1
  private readonly targetFrom = new THREE.Vector3()
  private readonly targetTo = new THREE.Vector3()
  private readonly camFrom = new THREE.Vector3()
  private readonly camTo = new THREE.Vector3()

  constructor(
    private readonly container: HTMLElement,
    resolveUrl: (p: string) => string,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100)
    this.camera.position.set(0, 1.4, 3.2)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.minDistance = 1.2
    this.controls.maxDistance = 5
    this.controls.target.set(0, 1, 0)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 2)
    sun.position.set(2, 4, 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 12
    sun.shadow.camera.left = -2.5
    sun.shadow.camera.right = 2.5
    sun.shadow.camera.top = 3
    sun.shadow.camera.bottom = -1
    this.scene.add(sun)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 64),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    this.rig = new AvatarRig(this.loader, resolveUrl)
    this.scene.add(this.rig.root)

    this.applyBackgroundFromCss()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.loop()
  }

  on<K extends keyof ViewerEvents>(event: K, fn: ViewerEvents[K]): void {
    this.listeners[event] = fn
  }

  applyBackgroundFromCss(): void {
    const css = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (css) this.scene.background = new THREE.Color(css)
  }

  resize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private readonly loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = this.clock.getDelta()
    this.rig.update(dt)
    this.updateFocus(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  focus(target: FocusTarget): void {
    const bounds = this.rig.getBounds()
    if (bounds.isEmpty()) return
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    if (target === 'head') {
      const head = this.rig.getHeadWorldPosition()
      if (!head) return
      const look = head.clone().add(new THREE.Vector3(0, 0.05, 0))
      this.startFocus(look, look.clone().add(new THREE.Vector3(0, 0, 1.3)))
      return
    }
    const dist = Math.max(size.y * 1.6, 2.2)
    this.startFocus(center, new THREE.Vector3(center.x, center.y + size.y * 0.05, center.z + dist))
  }

  private startFocus(target: THREE.Vector3, camPos: THREE.Vector3): void {
    this.targetFrom.copy(this.controls.target)
    this.targetTo.copy(target)
    this.camFrom.copy(this.camera.position)
    this.camTo.copy(camPos)
    this.focusT = 0
  }

  private updateFocus(dt: number): void {
    if (this.focusT >= 1) return
    this.focusT = Math.min(1, this.focusT + dt / FOCUS_SECONDS)
    this.controls.target.lerpVectors(this.targetFrom, this.targetTo, this.focusT)
    this.camera.position.lerpVectors(this.camFrom, this.camTo, this.focusT)
  }

  async setBase(base: BaseModel): Promise<void> {
    this.listeners.loading?.('start', base.id)
    try {
      await this.rig.setBase(base)
      this.focus('body')
    } catch (e) {
      this.listeners.error?.(base.id, reasonOf(e))
      throw e
    } finally {
      this.listeners.loading?.('end', base.id)
    }
  }

  async equip(part: Part): Promise<void> {
    this.listeners.loading?.('start', part.id)
    try {
      await this.rig.equip(part)
    } catch (e) {
      this.listeners.error?.(part.id, reasonOf(e))
      throw e
    } finally {
      this.listeners.loading?.('end', part.id)
    }
  }

  unequip(partId: string): void {
    this.rig.unequip(partId)
  }

  setBodyVisible(visible: boolean): void {
    this.rig.setBodyVisible(visible)
  }

  async setVariant(part: Part, variant: Variant | null): Promise<void> {
    try {
      await this.rig.setVariant(part, variant)
    } catch (e) {
      this.listeners.error?.(part.id, reasonOf(e))
      throw e
    }
  }

  async playAnimation(anim: AnimationRef): Promise<void> {
    try {
      await this.rig.playAnimation(anim)
    } catch (e) {
      this.listeners.error?.(anim.id, reasonOf(e))
      throw e
    }
  }

  screenshot(width = 512, height = 768, quality = 0.8): string {
    const size = this.renderer.getSize(new THREE.Vector2())
    const aspect = this.camera.aspect
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/jpeg', quality)
    this.renderer.setSize(size.x, size.y, false)
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    return url
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run typecheck`
Expected: 无错误。若 `three/addons/environments/RoomEnvironment.js` 的构造函数签名在当前版本要求传 renderer，按 `@types/three` 的声明改成 `new RoomEnvironment(this.renderer)`。

- [ ] **Step 3: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: AvatarViewer 渲染、相机、灯光、聚焦与截图" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 应用状态 useAvatarState 与 状态到 3D 层的同步 viewerSync

**Files:**
- Create: `src/state/useAvatarState.ts`、`src/state/viewerSync.ts`
- Test: `tests/useAvatarState.test.ts`、`tests/viewerSync.test.ts`

**Interfaces:**
- Consumes: `slotRules` (Task 3)，类型 (Task 2)。
- Produces:
  - `useAvatarState(manifest)` 返回 `AvatarStore`：`state: { avatar: AvatarState; activeSlot: string }`（reactive，外部只读不写）、`manifest`、计算属性 `base`、`bodyVisible`、`visibleSlots`、`activeSlotDef`、`partsInActiveSlot`、`equippedIds: ComputedRef<Set<string>>`，方法 `partById`、`equip`、`unequip`、`toggle`、`applyPreset`、`setVariant`、`setBase(base): Part[]`（返回被卸下的部件）、`reset`、`replace(next)`、`setActiveSlot`。
  - `interface ViewerLike { setBase; equip; unequip; setBodyVisible; setVariant; playAnimation }`，`AvatarViewer` 满足它。
  - `diffEquipped(prev, next): { added: string[]; removed: string[] }`
  - `createViewerSync(store, viewer, manifest, onError): { stop(); idle(): Promise<void> }`。串行队列：换底模时先 `setBase`，再播放 `manifest.animations[0]`，再把当前所有部件装回；其余情况按 diff 卸、装、换贴图；每次结束后设置底模可见性。装失败的部件调用 `onError(partId, err)` 并从状态里移除。

- [ ] **Step 1: 写 useAvatarState 测试**

`tests/useAvatarState.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { useAvatarState } from '@/state/useAvatarState'
import { makeManifest, part } from './fixtures/manifest'

describe('useAvatarState', () => {
  it('初始为第一个底模、全空、身体可见、第一个槽位激活', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    expect(s.state.avatar.baseId).toBe('female_regular')
    expect(s.bodyVisible.value).toBe(true)
    expect(s.state.activeSlot).toBe('hair')
    expect(s.partsInActiveSlot.value.map((p) => p.id)).toEqual(['hair_f'])
    expect(s.visibleSlots.value.map((x) => x.id)).toEqual(m.slots.map((x) => x.id))
  })

  it('没有部件的槽位不出现在 visibleSlots', () => {
    const m = makeManifest()
    m.parts = m.parts.filter((p) => p.slot !== 'eyebrows')
    const s = useAvatarState(m)
    expect(s.visibleSlots.value.map((x) => x.id)).not.toContain('eyebrows')
  })

  it('toggle：单选槽位重复点击保持，多选槽位重复点击卸下', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.toggle(part(m, 'ranger_body'))
    s.toggle(part(m, 'ranger_body'))
    expect(s.state.avatar.equipped.body).toEqual(['ranger_body'])
    expect(s.bodyVisible.value).toBe(false)
    s.toggle(part(m, 'hood'))
    s.toggle(part(m, 'hood'))
    expect(s.state.avatar.equipped.accessory).toEqual([])
    expect(s.equippedIds.value.has('ranger_arms')).toBe(true)
  })

  it('setBase 返回被卸下的部件并切换 partsInActiveSlot 的过滤', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.equip(part(m, 'hair_f'))
    const removed = s.setBase(m.bases[1])
    expect(removed.map((p) => p.id)).toEqual(['hair_f'])
    expect(s.base.value.id).toBe('male_regular')
    expect(s.partsInActiveSlot.value.map((p) => p.id)).toEqual(['hair_m'])
  })

  it('reset 回到初始；replace 整体替换', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.equip(part(m, 'ranger_body'))
    s.reset()
    expect(s.bodyVisible.value).toBe(true)
    s.replace({ baseId: 'male_regular', equipped: { hair: ['hair_m'] }, variants: {} })
    expect(s.state.avatar.baseId).toBe('male_regular')
    expect(s.state.avatar.equipped.hair).toEqual(['hair_m'])
  })
})
```

- [ ] **Step 2: 写 viewerSync 测试**

`tests/viewerSync.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import type { AnimationRef, BaseModel, Part, Variant } from '@/types/manifest'
import { useAvatarState } from '@/state/useAvatarState'
import { createViewerSync, diffEquipped, type ViewerLike } from '@/state/viewerSync'
import { makeManifest, part } from './fixtures/manifest'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeViewer implements ViewerLike {
  calls: string[] = []
  equipped = new Set<string>()
  variants = new Map<string, string | null>()
  body = true
  base = ''
  failEquip = new Set<string>()
  gates = new Map<string, Promise<void>>()
  async setBase(b: BaseModel) { this.calls.push(`base:${b.id}`); this.base = b.id; this.equipped.clear() }
  async equip(p: Part) {
    this.calls.push(`equip:${p.id}`)
    await this.gates.get(p.id)
    if (this.failEquip.has(p.id)) throw new Error('boom')
    this.equipped.add(p.id)
  }
  unequip(id: string) { this.calls.push(`unequip:${id}`); this.equipped.delete(id) }
  setBodyVisible(v: boolean) { this.body = v }
  async setVariant(p: Part, v: Variant | null) { this.variants.set(p.id, v?.id ?? null) }
  async playAnimation(a: AnimationRef) { this.calls.push(`anim:${a.id}`) }
}

function setup() {
  const m = makeManifest()
  const store = useAvatarState(m)
  const viewer = new FakeViewer()
  const onError = vi.fn()
  const sync = createViewerSync(store, viewer, m, onError)
  return { m, store, viewer, sync, onError }
}

describe('diffEquipped', () => {
  it('算出新增与移除', () => {
    expect(diffEquipped({ a: ['x'], b: ['y'] }, { a: ['x', 'z'], b: [] })).toEqual({ added: ['z'], removed: ['y'] })
  })
})

describe('createViewerSync', () => {
  it('启动时设置底模、播放待机动画、身体可见', async () => {
    const { viewer, sync } = setup()
    await sync.idle()
    expect(viewer.calls).toEqual(['base:female_regular', 'anim:idle'])
    expect(viewer.body).toBe(true)
  })

  it('装一件服装后四件都装上，身体隐藏；卸下后调用 unequip', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    expect([...viewer.equipped].sort()).toEqual(['ranger_arms', 'ranger_body', 'ranger_feet', 'ranger_legs'])
    expect(viewer.body).toBe(false)
    store.unequip('body')
    await sync.idle()
    expect(viewer.calls).toContain('unequip:ranger_body')
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })

  it('装失败的部件上报错误并从状态移除', async () => {
    const { m, store, viewer, sync, onError } = setup()
    viewer.failEquip.add('hood')
    await sync.idle()
    store.equip(part(m, 'hood'))
    await sync.idle()
    expect(onError).toHaveBeenCalledWith('hood', expect.any(Error))
    expect(store.state.avatar.equipped.accessory).toEqual([])
    expect(viewer.equipped.has('hood')).toBe(false)
  })

  it('换底模后重新装回仍匹配的部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'hair_f'))
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    store.setBase(m.bases[1])
    await sync.idle()
    expect(viewer.base).toBe('male_regular')
    expect(viewer.equipped.has('hair_f')).toBe(false)
    expect(viewer.equipped.has('ranger_body')).toBe(true)
    expect(viewer.calls.filter((c) => c === 'anim:idle')).toHaveLength(2)
  })

  it('变体切换与恢复', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    store.setVariant('ranger_body', 'b')
    await sync.idle()
    expect(viewer.variants.get('ranger_body')).toBe('b')
  })

  it('加载完成前卸下：最终不保留该部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    const gate = deferred()
    viewer.gates.set('ranger_body', gate.promise)
    store.equip(part(m, 'ranger_body'))
    store.unequip('body')
    gate.resolve()
    await sync.idle()
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/useAvatarState.test.ts tests/viewerSync.test.ts`
Expected: FAIL，找不到模块。

- [ ] **Step 4: 实现 useAvatarState.ts**

```ts
import { computed, reactive } from 'vue'
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'
import * as rules from '@/avatar/slotRules'
import type { AvatarState } from '@/avatar/slotRules'

export function useAvatarState(manifest: Manifest) {
  const state = reactive<{ avatar: AvatarState; activeSlot: string }>({
    avatar: rules.createEmptyState(manifest, manifest.bases[0].id),
    activeSlot: manifest.slots[0]?.id ?? '',
  })

  const base = computed<BaseModel>(
    () => manifest.bases.find((b) => b.id === state.avatar.baseId) ?? manifest.bases[0],
  )
  const bodyVisible = computed(() => rules.computeBodyVisible(state.avatar, manifest.slots))
  const visibleSlots = computed<Slot[]>(() =>
    manifest.slots.filter((s) => rules.partsForSlot(manifest, s.id, base.value).length > 0),
  )
  const activeSlotDef = computed<Slot | undefined>(() => manifest.slots.find((s) => s.id === state.activeSlot))
  const partsInActiveSlot = computed<Part[]>(() => rules.partsForSlot(manifest, state.activeSlot, base.value))
  const equippedIds = computed(() => new Set(Object.values(state.avatar.equipped).flat()))

  const partById = (id: string): Part | undefined => manifest.parts.find((p) => p.id === id)

  function equip(part: Part): void {
    state.avatar = rules.equipPart(state.avatar, part, manifest)
  }
  function unequip(slotId: string, partId?: string): void {
    state.avatar = rules.unequipPart(state.avatar, slotId, partId)
  }
  function toggle(part: Part): void {
    const slot = manifest.slots.find((s) => s.id === part.slot)
    const current = state.avatar.equipped[part.slot] ?? []
    if (current.includes(part.id)) {
      if (slot?.multiple) unequip(part.slot, part.id)
      return
    }
    equip(part)
  }
  function applyPreset(preset: Preset): void {
    state.avatar = rules.applyPreset(state.avatar, preset, manifest)
  }
  function setVariant(partId: string, variantId: string): void {
    state.avatar = rules.setVariant(state.avatar, partId, variantId)
  }
  function setBase(b: BaseModel): Part[] {
    const r = rules.changeBase(state.avatar, b, manifest)
    state.avatar = r.state
    return r.removed
  }
  function reset(): void {
    state.avatar = rules.createEmptyState(manifest, manifest.bases[0].id)
  }
  function replace(next: AvatarState): void {
    state.avatar = next
  }
  function setActiveSlot(id: string): void {
    state.activeSlot = id
  }

  return {
    state, manifest, base, bodyVisible, visibleSlots, activeSlotDef, partsInActiveSlot, equippedIds,
    partById, equip, unequip, toggle, applyPreset, setVariant, setBase, reset, replace, setActiveSlot,
  }
}

export type AvatarStore = ReturnType<typeof useAvatarState>
```

- [ ] **Step 5: 实现 viewerSync.ts**

```ts
import { nextTick, watch } from 'vue'
import type { AnimationRef, BaseModel, Manifest, Part, Variant } from '@/types/manifest'
import { computeBodyVisible, type AvatarState } from '@/avatar/slotRules'
import type { AvatarStore } from './useAvatarState'

export interface ViewerLike {
  setBase(base: BaseModel): Promise<void>
  equip(part: Part): Promise<void>
  unequip(partId: string): void
  setBodyVisible(visible: boolean): void
  setVariant(part: Part, variant: Variant | null): Promise<void>
  playAnimation(anim: AnimationRef): Promise<void>
}

export function diffEquipped(
  prev: Record<string, string[]>,
  next: Record<string, string[]>,
): { added: string[]; removed: string[] } {
  const p = new Set(Object.values(prev).flat())
  const n = new Set(Object.values(next).flat())
  return {
    added: [...n].filter((id) => !p.has(id)),
    removed: [...p].filter((id) => !n.has(id)),
  }
}

export interface ViewerSync {
  stop(): void
  /** 等到所有排队的同步动作都完成 */
  idle(): Promise<void>
}

export function createViewerSync(
  store: AvatarStore,
  viewer: ViewerLike,
  manifest: Manifest,
  onError: (id: string, err: unknown) => void,
): ViewerSync {
  let queue: Promise<void> = Promise.resolve()
  const idleAnim: AnimationRef | undefined = manifest.animations[0]
  const partOf = (id: string) => manifest.parts.find((p) => p.id === id)

  async function applyVariant(part: Part, variantId: string | undefined): Promise<void> {
    const variant = variantId ? (part.variants.find((v) => v.id === variantId) ?? null) : null
    await viewer.setVariant(part, variant).catch((e: unknown) => onError(part.id, e))
  }

  async function equipAll(ids: string[], state: AvatarState): Promise<void> {
    for (const id of ids) {
      const part = partOf(id)
      if (!part) continue
      try {
        await viewer.equip(part)
      } catch (e) {
        onError(id, e)
        store.unequip(part.slot, id)
        continue
      }
      if (state.variants[id]) await applyVariant(part, state.variants[id])
    }
  }

  async function apply(next: AvatarState, prev: AvatarState | undefined): Promise<void> {
    if (!prev || prev.baseId !== next.baseId) {
      const base = manifest.bases.find((b) => b.id === next.baseId)
      if (!base) return
      try {
        await viewer.setBase(base)
      } catch (e) {
        onError(base.id, e)
        return
      }
      if (idleAnim) await viewer.playAnimation(idleAnim).catch((e: unknown) => onError(idleAnim.id, e))
      await equipAll(Object.values(next.equipped).flat(), next)
    } else {
      const { added, removed } = diffEquipped(prev.equipped, next.equipped)
      for (const id of removed) viewer.unequip(id)
      await equipAll(added, next)
      for (const [id, variantId] of Object.entries(next.variants)) {
        if (added.includes(id) || prev.variants[id] === variantId) continue
        const part = partOf(id)
        if (part) await applyVariant(part, variantId)
      }
      for (const id of Object.keys(prev.variants)) {
        if (id in next.variants || removed.includes(id)) continue
        const part = partOf(id)
        if (part) await applyVariant(part, undefined)
      }
    }
    viewer.setBodyVisible(computeBodyVisible(next, manifest.slots))
  }

  const stop = watch(
    () => store.state.avatar,
    (next, prev) => {
      queue = queue.then(() => apply(next, prev))
    },
    { immediate: true },
  )

  async function idle(): Promise<void> {
    let last: Promise<void>
    do {
      await nextTick()
      last = queue
      await last
    } while (last !== queue)
  }

  return { stop, idle }
}
```

- [ ] **Step 6: 运行确认通过**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npx vitest run tests/useAvatarState.test.ts tests/viewerSync.test.ts && npm run typecheck`
Expected: 12 个 PASS。

- [ ] **Step 7: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 应用状态与 3D 同步层" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 缩略图离屏渲染 ThumbnailRenderer

**Files:**
- Create: `src/avatar/ThumbnailRenderer.ts`

**Interfaces:**
- Consumes: `GltfSource` (Task 6)，`idb-keyval`。
- Produces: `class ThumbnailRenderer`，构造 `(source: GltfSource, resolveUrl, version: number, size = 128)`；`get(part): Promise<string>` 返回 PNG data URL，串行排队，内存 + IndexedDB 两级缓存，key 为 `thumb:${version}:${part.id}`；`dispose()`。
- 浏览器验证在 Task 10。

- [ ] **Step 1: 实现**

```ts
import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { get, set } from 'idb-keyval'
import type { Part } from '@/types/manifest'
import type { GltfSource } from './PartLoader'

export class ThumbnailRenderer {
  private renderer: THREE.WebGLRenderer | null = null
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50)
  private readonly memory = new Map<string, string>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly source: GltfSource,
    private readonly resolveUrl: (p: string) => string,
    private readonly version: number,
    private readonly size = 128,
  ) {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2)
    key.position.set(1, 2, 2)
    this.scene.add(key)
  }

  get(part: Part): Promise<string> {
    const run = () => this.produce(part)
    const p = this.queue.then(run, run)
    this.queue = p.catch(() => undefined)
    return p
  }

  private cacheKey(part: Part): string {
    return `thumb:${this.version}:${part.id}`
  }

  private async produce(part: Part): Promise<string> {
    const key = this.cacheKey(part)
    const mem = this.memory.get(key)
    if (mem) return mem
    let cached: string | undefined
    try {
      cached = await get<string>(key)
    } catch {
      cached = undefined
    }
    if (cached) {
      this.memory.set(key, cached)
      return cached
    }
    const url = await this.render(part)
    this.memory.set(key, url)
    try {
      await set(key, url)
    } catch {
      // IndexedDB 不可用时只保留内存缓存
    }
    return url
  }

  private async render(part: Part): Promise<string> {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(this.size, this.size, false)
      this.renderer.setClearColor(0x000000, 0)
    }
    const gltf = await this.source.load(this.resolveUrl(part.url))
    const obj = SkeletonUtils.clone(gltf.scene)
    obj.traverse((o) => {
      o.frustumCulled = false
    })
    this.scene.add(obj)
    obj.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj, true)
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05)
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.1
    this.camera.position.set(center.x + dist * 0.4, center.y + dist * 0.3, center.z + dist * 0.85)
    this.camera.lookAt(center)
    this.renderer.render(this.scene, this.camera)
    const dataUrl = this.renderer.domElement.toDataURL('image/png')
    this.scene.remove(obj)
    return dataUrl
  }

  dispose(): void {
    this.renderer?.dispose()
    this.renderer = null
    this.memory.clear()
  }
}
```

- [ ] **Step 2: 类型检查并提交**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run typecheck`
Expected: 无错误。

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 部件缩略图离屏渲染与缓存" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 页面与面板组件，浏览器验证 M1/M2

**Files:**
- Create: `src/components/SlotIcon.vue`、`src/components/BaseSelect.vue`、`src/components/TopBar.vue`、`src/components/PartsPanel.vue`、`src/components/DressUp.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: Task 2 到 Task 9 的全部导出。
- Produces: 可运行的换装页。`TopBar` 本任务只有主题切换和重置，Task 11 再加保存与「我的形象」。
- 前置条件：`public/avatar/manifest.json` 必须存在。没有就先完成 Task 5 Step 7；`assets-src/` 还是空的就停下来，请用户按 `docs/ASSETS.md` 下载解压后再继续。

- [ ] **Step 1: 确认素材与 manifest 就绪**

Run: `cd "G:/xuexi/2023/avatar-dressup" && ls public/avatar/manifest.json && npx vitest run tests/realManifest.test.ts`
Expected: 文件存在，测试 PASS（不是 skipped）。否则按前置条件处理。

- [ ] **Step 2: 写 SlotIcon.vue 与 BaseSelect.vue**

`src/components/SlotIcon.vue`:
```vue
<script setup lang="ts">
const props = defineProps<{ slot: string }>()

const PATHS: Record<string, string> = {
  hair: 'M4 14c0-5 3-9 8-9s8 4 8 9M6 14v4M18 14v4M9 9c-1 2-1 5 0 7',
  eyebrows: 'M3 10c3-3 6-3 8 0M13 10c3-3 6-3 8 0',
  body: 'M8 4l4 2 4-2 4 3-2 4-2-1v10H8V10l-2 1-2-4z',
  arms: 'M4 6l3-2 3 3-2 7-3 1zM20 6l-3-2-3 3 2 7 3 1z',
  legs: 'M7 3h10l1 18h-4l-2-9-2 9H6z',
  feet: 'M7 3h6v8h3c2 0 4 2 4 4v2H6l1-6z',
  accessory: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z',
}
const d = () => PATHS[props.slot] ?? 'M4 4h16v16H4z'
</script>

<template>
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="d()" />
  </svg>
</template>
```

`src/components/BaseSelect.vue`:
```vue
<script setup lang="ts">
import type { BaseModel } from '@/types/manifest'

defineProps<{ bases: BaseModel[]; modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', id: string): void }>()

function onChange(ev: Event) {
  emit('update:modelValue', (ev.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="base-select">
    <span>底模</span>
    <select :value="modelValue" @change="onChange">
      <option v-for="b in bases" :key="b.id" :value="b.id">{{ b.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.base-select {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
select {
  flex: 1;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel-deep);
  color: var(--text);
}
</style>
```

- [ ] **Step 3: 写 TopBar.vue（本任务版本）**

```vue
<script setup lang="ts">
defineProps<{ theme: string }>()
const emit = defineEmits<{
  (e: 'update:theme', theme: string): void
  (e: 'reset'): void
}>()

const THEMES = [
  { id: 'dark', label: '深色' },
  { id: 'night', label: '夜黑' },
  { id: 'light', label: '浅色' },
  { id: 'purple', label: '紫色' },
]
</script>

<template>
  <header class="topbar">
    <div class="topbar__brand">虚拟人换装</div>
    <div class="topbar__actions">
      <select class="btn" :value="theme" @change="emit('update:theme', ($event.target as HTMLSelectElement).value)">
        <option v-for="t in THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <button class="btn" @click="emit('reset')">重置</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.topbar__brand {
  font-size: 18px;
  font-weight: 600;
}
.topbar__actions {
  display: flex;
  gap: 12px;
}
.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--btn-transparent);
  color: var(--text);
}
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: 写 PartsPanel.vue**

```vue
<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import type { Part } from '@/types/manifest'
import type { AvatarStore } from '@/state/useAvatarState'
import type { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'
import SlotIcon from './SlotIcon.vue'
import BaseSelect from './BaseSelect.vue'

const props = defineProps<{
  store: AvatarStore
  thumbs: ThumbnailRenderer | null
  errors: Map<string, string>
  loading: Set<string>
}>()
const emit = defineEmits<{ (e: 'notice', text: string): void }>()

const avatar = computed(() => props.store.state.avatar)
const slots = computed(() => props.store.visibleSlots.value)
const activeSlot = computed(() => props.store.activeSlotDef.value)
const parts = computed(() => props.store.partsInActiveSlot.value)
const equippedIds = computed(() => props.store.equippedIds.value)
const presets = computed(() => props.store.manifest.presets)
const variantParts = computed<Part[]>(() =>
  (avatar.value.equipped[props.store.state.activeSlot] ?? [])
    .map((id) => props.store.partById(id))
    .filter((p): p is Part => !!p && p.variants.length > 0),
)
const slotEmpty = computed(() => {
  const s = activeSlot.value
  return !s || (avatar.value.equipped[s.id] ?? []).length === 0
})

const thumbUrls = reactive(new Map<string, string>())
const requested = new Set<string>()
watchEffect(() => {
  const renderer = props.thumbs
  if (!renderer) return
  for (const p of parts.value) {
    if (requested.has(p.id)) continue
    requested.add(p.id)
    renderer.get(p).then((url) => thumbUrls.set(p.id, url)).catch(() => requested.delete(p.id))
  }
})

function onBase(id: string) {
  const base = props.store.manifest.bases.find((b) => b.id === id)
  if (!base) return
  const removed = props.store.setBase(base)
  if (removed.length) emit('notice', `已卸下不适用于该底模的部件：${removed.map((p) => p.label).join('、')}`)
}

function clearSlot() {
  if (activeSlot.value) props.store.unequip(activeSlot.value.id)
}
</script>

<template>
  <div class="panel">
    <div class="panel__section">
      <BaseSelect :bases="store.manifest.bases" :model-value="avatar.baseId" @update:model-value="onBase" />
    </div>

    <nav class="slots">
      <button v-for="s in slots" :key="s.id" class="slot" :class="{ active: s.id === store.state.activeSlot }"
        :title="s.label" @click="store.setActiveSlot(s.id)">
        <SlotIcon :slot="s.id" />
        <span>{{ s.label }}</span>
      </button>
    </nav>

    <div v-if="activeSlot?.outfit && presets.length" class="chips">
      <span class="chips__label">套装</span>
      <button v-for="p in presets" :key="p.id" class="chip" @click="store.applyPreset(p)">{{ p.label }}</button>
    </div>

    <div class="grid">
      <button v-if="activeSlot && !activeSlot.multiple" class="cell cell--none" :class="{ active: slotEmpty }" @click="clearSlot">
        无
      </button>
      <button v-for="p in parts" :key="p.id" class="cell"
        :class="{ active: equippedIds.has(p.id), error: errors.has(p.id) }"
        :title="errors.get(p.id) ?? p.label" :disabled="errors.has(p.id)" @click="store.toggle(p)">
        <img v-if="thumbUrls.get(p.id)" class="cell__img" :src="thumbUrls.get(p.id)" :alt="p.label" />
        <span v-else class="cell__placeholder">{{ p.label }}</span>
        <span v-if="loading.has(p.id)" class="cell__spinner" />
        <span class="cell__name">{{ p.label }}</span>
      </button>
    </div>

    <div v-if="variantParts.length" class="variants">
      <div v-for="p in variantParts" :key="p.id" class="chips">
        <span class="chips__label">{{ p.label }} 配色</span>
        <button v-for="v in p.variants" :key="v.id" class="chip" :class="{ active: avatar.variants[p.id] === v.id }"
          @click="store.setVariant(p.id, v.id)">{{ v.label }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  overflow: hidden;
}
.slots {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.slot {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 64px;
  padding: 8px 0;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--btn-transparent);
  color: var(--text-muted);
  font-size: 12px;
}
.slot.active {
  color: var(--accent);
  border-color: var(--accent);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chips__label {
  color: var(--text-muted);
  font-size: 12px;
}
.chip {
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--btn-transparent);
  color: var(--text);
  font-size: 12px;
}
.chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 132px;
  gap: 10px;
  overflow-y: auto;
  align-content: start;
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 2px solid transparent;
  background: var(--panel-deep);
  color: var(--text);
  overflow: hidden;
}
.cell.active {
  border-color: var(--accent);
}
.cell.error {
  opacity: 0.4;
  cursor: not-allowed;
}
.cell--none {
  color: var(--text-muted);
  font-size: 16px;
}
.cell__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cell__placeholder {
  padding: 8px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
.cell__name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell__spinner {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
```

- [ ] **Step 5: 写 DressUp.vue（本任务版本）**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { Manifest } from '@/types/manifest'
import { ManifestError, loadManifest } from '@/data/manifest'
import { assetUrl } from '@/data/assetUrl'
import { AvatarViewer } from '@/avatar/AvatarViewer'
import { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'
import { useAvatarState, type AvatarStore } from '@/state/useAvatarState'
import { createViewerSync, type ViewerSync } from '@/state/viewerSync'
import TopBar from './TopBar.vue'
import PartsPanel from './PartsPanel.vue'

const THEME_KEY = 'avatar-dressup.theme'

const viewport = ref<HTMLElement | null>(null)
const manifest = shallowRef<Manifest | null>(null)
const store = shallowRef<AvatarStore | null>(null)
const viewer = shallowRef<AvatarViewer | null>(null)
const thumbs = shallowRef<ThumbnailRenderer | null>(null)
let sync: ViewerSync | null = null

const fatalError = ref('')
const partErrors = reactive(new Map<string, string>())
const loadingIds = reactive(new Set<string>())
const toast = ref('')
let toastTimer = 0

const theme = ref(readTheme())

function readTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'dark'
  } catch {
    return 'dark'
  }
}

function setTheme(t: string) {
  theme.value = t
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    // 隐私模式下忽略
  }
  viewer.value?.applyBackgroundFromCss()
}

function showToast(text: string) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 3200)
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function onReset() {
  store.value?.reset()
  partErrors.clear()
}

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value
  const host = viewport.value
  if (!host) return
  try {
    const m = await loadManifest()
    manifest.value = m
    const s = useAvatarState(m)
    store.value = s
    const v = new AvatarViewer(host, assetUrl)
    v.on('loading', (phase, id) => (phase === 'start' ? loadingIds.add(id) : loadingIds.delete(id)))
    v.on('error', (id, reason) => partErrors.set(id, reason))
    viewer.value = v
    thumbs.value = new ThumbnailRenderer(v.loader, assetUrl, m.version)
    sync = createViewerSync(s, v, m, (id, err) => {
      partErrors.set(id, reasonOf(err))
      showToast(`「${s.partById(id)?.label ?? id}」加载失败：${reasonOf(err)}`)
    })
    watch(
      () => s.state.activeSlot,
      (slotId) => {
        const slot = m.slots.find((x) => x.id === slotId)
        v.focus(slot?.group === 'head' ? 'head' : 'body')
      },
    )
  } catch (e) {
    fatalError.value = e instanceof ManifestError ? e.message : `初始化失败：${reasonOf(e)}`
  }
})

onBeforeUnmount(() => {
  sync?.stop()
  thumbs.value?.dispose()
  viewer.value?.dispose()
})
</script>

<template>
  <div class="dressup">
    <TopBar :theme="theme" @update:theme="setTheme" @reset="onReset" />
    <div class="dressup__main">
      <section ref="viewport" class="viewport">
        <pre v-if="fatalError" class="fatal">{{ fatalError }}</pre>
        <div v-else-if="loadingIds.size" class="viewport__loading">加载中…</div>
      </section>
      <aside class="side">
        <PartsPanel v-if="store" :store="store" :thumbs="thumbs" :errors="partErrors" :loading="loadingIds" @notice="showToast" />
      </aside>
    </div>
    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.dressup {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.dressup__main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bg);
}
.viewport__loading {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--panel);
  color: var(--text-muted);
  font-size: 12px;
}
.fatal {
  position: absolute;
  inset: 24px;
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--panel);
  color: #ff6b6b;
  white-space: pre-wrap;
  overflow: auto;
}
.side {
  width: 560px;
  flex: 0 0 560px;
  background: var(--panel);
  border-left: 1px solid var(--border);
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

`src/App.vue` 改为：
```vue
<script setup lang="ts">
import DressUp from './components/DressUp.vue'
</script>

<template>
  <DressUp />
</template>
```

- [ ] **Step 6: 类型检查并启动开发服务器**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run typecheck && npm run dev`
Expected: typecheck 无错误；Vite 打印本地地址（通常 `http://localhost:5173`）。

- [ ] **Step 7: 浏览器验证 M1**

在浏览器打开开发地址并截图，逐项确认：

1. 底模出现在视口中央，脚下有阴影，待机动画在播放（肢体轻微摆动）。
2. 右侧面板显示底模下拉框、部位图标条、部件网格；网格里的格子逐个出现缩略图。
3. 点「上身」槽位里的一件服装：四个服装槽位都装上同套部件，底模身体被隐藏，衣服跟随动画摆动，没有骨骼错位（袖子不脱离手臂、裤子不悬空）。
4. 点「无」：该槽位卸下；把四个服装槽位都卸掉后底模身体重新可见。

若第 3 步出现明显错位：在 `src/avatar/rebind.ts` 把 `new Matrix4()` 改成 `mesh.matrixWorld.clone()`（先对部件场景调用 `updateMatrixWorld(true)`），重跑 `tests/rebind.test.ts` 并把断言调整为新行为，再验证。这是设计文档第 14 节预见的风险。

- [ ] **Step 8: 浏览器验证 M2**

1. 点「发型」槽位：相机平滑推到头部；换一个发型生效；再点「上身」相机拉回全身。
2. 点「套装」行的另一个预设：四个槽位整体替换。
3. 若 manifest 里有变体：装上有变体的部件后出现「配色」色块行，点击切换贴图。
4. 底模下拉框切到另一性别：模型替换，提示里列出被卸下的部件，适用部件重新装回。
5. 切换四种主题：背景色随之变化。
6. 浏览器控制台没有未捕获的错误。

- [ ] **Step 9: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 换装页面与部件面板" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 保存、恢复、我的形象抽屉（M3）

**Files:**
- Create: `src/components/NameDialog.vue`、`src/components/SavesDrawer.vue`
- Modify: `src/components/TopBar.vue`（加保存与我的形象按钮）、`src/components/DressUp.vue`（接线）

**Interfaces:**
- Consumes: `saves.ts` (Task 4)、`AvatarViewer.screenshot` (Task 7)、`store.replace` (Task 8)。
- Produces: `NameDialog` props `{ open: boolean; defaultName: string }`，emits `confirm(name)`、`cancel`；`SavesDrawer` props `{ open: boolean; records: SaveRecord[] }`，emits `close`、`restore(record)`、`remove(id)`；`TopBar` 新增 props `{ canSave: boolean; savesCount: number }` 与 emits `save`、`open-saves`。

- [ ] **Step 1: 写 NameDialog.vue**

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; defaultName: string }>()
const emit = defineEmits<{
  (e: 'confirm', name: string): void
  (e: 'cancel'): void
}>()

const name = ref('')
const input = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    name.value = props.defaultName
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
)

function submit() {
  const n = name.value.trim()
  if (!n) return
  emit('confirm', n)
}
</script>

<template>
  <div v-if="open" class="mask" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <form class="dialog" @submit.prevent="submit">
      <h3>保存形象</h3>
      <input ref="input" v-model="name" maxlength="30" placeholder="给这个形象起个名字" />
      <div class="dialog__actions">
        <button type="button" class="btn" @click="emit('cancel')">取消</button>
        <button type="submit" class="btn btn--primary" :disabled="!name.trim()">保存</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  z-index: 20;
}
.dialog {
  width: 360px;
  padding: 24px;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h3 {
  margin: 0;
  font-size: 18px;
}
input {
  height: 40px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel-deep);
  color: var(--text);
}
.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--btn-transparent);
  color: var(--text);
}
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: 写 SavesDrawer.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SaveRecord } from '@/types/save'

defineProps<{ open: boolean; records: SaveRecord[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'restore', record: SaveRecord): void
  (e: 'remove', id: string): void
}>()

const pendingDelete = ref('')
let timer = 0

function askDelete(id: string) {
  if (pendingDelete.value === id) {
    pendingDelete.value = ''
    emit('remove', id)
    return
  }
  pendingDelete.value = id
  clearTimeout(timer)
  timer = window.setTimeout(() => (pendingDelete.value = ''), 3000)
}

function fmt(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <transition name="slide">
    <aside v-if="open" class="drawer">
      <header class="drawer__head">
        <strong>我的形象（{{ records.length }}）</strong>
        <button class="btn" @click="emit('close')">关闭</button>
      </header>
      <p v-if="!records.length" class="drawer__empty">还没有保存过形象。换好装后点右上角「保存」。</p>
      <ul v-else class="list">
        <li v-for="r in records" :key="r.id" class="item">
          <img class="item__thumb" :src="r.thumbnail" :alt="r.name" @click="emit('restore', r)" />
          <div class="item__meta">
            <div class="item__name">{{ r.name }}</div>
            <div class="item__time">{{ fmt(r.createdAt) }}</div>
            <div class="item__actions">
              <button class="btn btn--primary" @click="emit('restore', r)">恢复</button>
              <button class="btn" :class="{ 'btn--danger': pendingDelete === r.id }" @click="askDelete(r.id)">
                {{ pendingDelete === r.id ? '确认删除' : '删除' }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </aside>
  </transition>
</template>

<style scoped>
.drawer {
  position: fixed;
  top: 64px;
  right: 0;
  bottom: 0;
  width: 420px;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.25);
  z-index: 10;
}
.drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.drawer__empty {
  padding: 24px 20px;
  color: var(--text-muted);
}
.list {
  list-style: none;
  margin: 0;
  padding: 12px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
  background: var(--panel-deep);
}
.item__thumb {
  width: 96px;
  height: 144px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
}
.item__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item__name {
  font-weight: 600;
}
.item__time {
  color: var(--text-muted);
  font-size: 12px;
}
.item__actions {
  margin-top: auto;
  display: flex;
  gap: 8px;
}
.btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--btn-transparent);
  color: var(--text);
  font-size: 13px;
}
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn--danger {
  background: #d9534f;
  border-color: #d9534f;
  color: #fff;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
```

- [ ] **Step 3: 改 TopBar.vue（最终版）**

```vue
<script setup lang="ts">
defineProps<{ theme: string; canSave: boolean; savesCount: number }>()
const emit = defineEmits<{
  (e: 'update:theme', theme: string): void
  (e: 'reset'): void
  (e: 'save'): void
  (e: 'open-saves'): void
}>()

const THEMES = [
  { id: 'dark', label: '深色' },
  { id: 'night', label: '夜黑' },
  { id: 'light', label: '浅色' },
  { id: 'purple', label: '紫色' },
]
</script>

<template>
  <header class="topbar">
    <div class="topbar__brand">虚拟人换装</div>
    <div class="topbar__actions">
      <select class="btn" :value="theme" @change="emit('update:theme', ($event.target as HTMLSelectElement).value)">
        <option v-for="t in THEMES" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <button class="btn" @click="emit('reset')">重置</button>
      <button class="btn" @click="emit('open-saves')">我的形象（{{ savesCount }}）</button>
      <button class="btn btn--primary" :disabled="!canSave" :title="canSave ? '' : '当前浏览器不支持本地存储'" @click="emit('save')">
        保存
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.topbar__brand {
  font-size: 18px;
  font-weight: 600;
}
.topbar__actions {
  display: flex;
  gap: 12px;
}
.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--btn-transparent);
  color: var(--text);
}
.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: 改 DressUp.vue（最终版，整文件替换）**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { Manifest } from '@/types/manifest'
import type { SaveRecord } from '@/types/save'
import { ManifestError, loadManifest } from '@/data/manifest'
import { assetUrl } from '@/data/assetUrl'
import { SavesFullError, addSave, deleteSave, fromSaveRecord, listSaves, toSaveRecord } from '@/data/saves'
import { AvatarViewer } from '@/avatar/AvatarViewer'
import { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'
import { useAvatarState, type AvatarStore } from '@/state/useAvatarState'
import { createViewerSync, type ViewerSync } from '@/state/viewerSync'
import TopBar from './TopBar.vue'
import PartsPanel from './PartsPanel.vue'
import NameDialog from './NameDialog.vue'
import SavesDrawer from './SavesDrawer.vue'

const THEME_KEY = 'avatar-dressup.theme'

const viewport = ref<HTMLElement | null>(null)
const manifest = shallowRef<Manifest | null>(null)
const store = shallowRef<AvatarStore | null>(null)
const viewer = shallowRef<AvatarViewer | null>(null)
const thumbs = shallowRef<ThumbnailRenderer | null>(null)
let sync: ViewerSync | null = null

const fatalError = ref('')
const partErrors = reactive(new Map<string, string>())
const loadingIds = reactive(new Set<string>())
const toast = ref('')
let toastTimer = 0

const theme = ref(readTheme())

const savesAvailable = ref(false)
const saves = ref<SaveRecord[]>([])
const dialogOpen = ref(false)
const drawerOpen = ref(false)

function readTheme(): string {
  try {
    return localStorage.getItem(THEME_KEY) ?? 'dark'
  } catch {
    return 'dark'
  }
}

function setTheme(t: string) {
  theme.value = t
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    // 隐私模式下忽略
  }
  viewer.value?.applyBackgroundFromCss()
}

function showToast(text: string) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 3200)
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function onReset() {
  store.value?.reset()
  partErrors.clear()
}

async function refreshSaves() {
  try {
    saves.value = await listSaves()
    savesAvailable.value = true
  } catch {
    savesAvailable.value = false
    saves.value = []
  }
}

function defaultName(): string {
  const n = saves.value.length + 1
  return `形象 ${n}`
}

async function onConfirmName(name: string) {
  dialogOpen.value = false
  const s = store.value
  const v = viewer.value
  const m = manifest.value
  if (!s || !v || !m) return
  if (sync) await sync.idle()
  const thumbnail = v.screenshot(384, 576)
  try {
    saves.value = await addSave(toSaveRecord(s.state.avatar, name, thumbnail, m.version))
    showToast(`已保存「${name}」`)
  } catch (e) {
    showToast(e instanceof SavesFullError ? e.message : `保存失败：${reasonOf(e)}`)
  }
}

function onRestore(record: SaveRecord) {
  const s = store.value
  const m = manifest.value
  if (!s || !m) return
  const { state, skipped } = fromSaveRecord(record, m)
  s.replace(state)
  drawerOpen.value = false
  showToast(skipped.length ? `已恢复「${record.name}」，有 ${skipped.length} 个部件已不存在被跳过` : `已恢复「${record.name}」`)
}

async function onRemove(id: string) {
  try {
    saves.value = await deleteSave(id)
  } catch (e) {
    showToast(`删除失败：${reasonOf(e)}`)
  }
}

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value
  const host = viewport.value
  if (!host) return
  try {
    const m = await loadManifest()
    manifest.value = m
    const s = useAvatarState(m)
    store.value = s
    const v = new AvatarViewer(host, assetUrl)
    v.on('loading', (phase, id) => (phase === 'start' ? loadingIds.add(id) : loadingIds.delete(id)))
    v.on('error', (id, reason) => partErrors.set(id, reason))
    viewer.value = v
    thumbs.value = new ThumbnailRenderer(v.loader, assetUrl, m.version)
    sync = createViewerSync(s, v, m, (id, err) => {
      partErrors.set(id, reasonOf(err))
      showToast(`「${s.partById(id)?.label ?? id}」加载失败：${reasonOf(err)}`)
    })
    watch(
      () => s.state.activeSlot,
      (slotId) => {
        const slot = m.slots.find((x) => x.id === slotId)
        v.focus(slot?.group === 'head' ? 'head' : 'body')
      },
    )
    await refreshSaves()
  } catch (e) {
    fatalError.value = e instanceof ManifestError ? e.message : `初始化失败：${reasonOf(e)}`
  }
})

onBeforeUnmount(() => {
  sync?.stop()
  thumbs.value?.dispose()
  viewer.value?.dispose()
})
</script>

<template>
  <div class="dressup">
    <TopBar :theme="theme" :can-save="savesAvailable && !!store" :saves-count="saves.length"
      @update:theme="setTheme" @reset="onReset" @save="dialogOpen = true" @open-saves="drawerOpen = true" />
    <div class="dressup__main">
      <section ref="viewport" class="viewport">
        <pre v-if="fatalError" class="fatal">{{ fatalError }}</pre>
        <div v-else-if="loadingIds.size" class="viewport__loading">加载中…</div>
      </section>
      <aside class="side">
        <PartsPanel v-if="store" :store="store" :thumbs="thumbs" :errors="partErrors" :loading="loadingIds" @notice="showToast" />
      </aside>
    </div>
    <NameDialog :open="dialogOpen" :default-name="defaultName()" @confirm="onConfirmName" @cancel="dialogOpen = false" />
    <SavesDrawer :open="drawerOpen" :records="saves" @close="drawerOpen = false" @restore="onRestore" @remove="onRemove" />
    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.dressup {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.dressup__main {
  flex: 1;
  display: flex;
  min-height: 0;
}
.viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--bg);
}
.viewport__loading {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--panel);
  color: var(--text-muted);
  font-size: 12px;
}
.fatal {
  position: absolute;
  inset: 24px;
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--panel);
  color: #ff6b6b;
  white-space: pre-wrap;
  overflow: auto;
}
.side {
  width: 560px;
  flex: 0 0 560px;
  background: var(--panel);
  border-left: 1px solid var(--border);
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  padding: 10px 16px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 30;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

- [ ] **Step 5: 类型检查、全部单测**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run typecheck && npm test`
Expected: 全部 PASS。

- [ ] **Step 6: 浏览器验证 M3**

开发服务器仍在运行时打开页面并截图确认：

1. 换好一套装后点「保存」，弹出命名框，默认名「形象 1」，回车后提示「已保存」，顶栏计数变成 1。
2. 点「我的形象」，抽屉里出现带截图的记录，截图是 384x576 竖图且背景色与当前主题一致。
3. 刷新页面，再打开抽屉，记录还在。点「恢复」后形象与保存时一致，包括配色变体和配饰。
4. 删除：第一次点变成「确认删除」，再点消失。
5. 把 `public/avatar/manifest.json` 里某个已保存部件临时改名，刷新后恢复该记录，提示「有 1 个部件已不存在被跳过」，其他部件正常。改回文件名。

- [ ] **Step 7: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "feat: 保存、恢复与我的形象抽屉" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: 收尾：README、构建、资源压缩验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 补 README**

在 README 末尾追加：

```markdown
## 开发流程

1. 按 `docs/ASSETS.md` 下载素材并解压到 `assets-src/`。
2. `npm run assets:scan` 检查归类，不对就改 `scripts/manifest.config.mjs`。
3. `npm run assets:build` 生成 `public/avatar/manifest.json` 与模型文件。
4. `npm run dev` 打开页面。

`npm run assets:build -- --optimize` 会对模型做网格去重、剪枝和动画重采样。贴图缩放未实现，需要时安装 `sharp` 并在 `scripts/build-manifest.mjs` 的 `writeGlb` 里加 `textureCompress`。

## 目录

- `src/avatar/` 纯 three.js：加载、骨骼重绑、装卸、相机、截图、缩略图
- `src/state/` 状态与同步：`useAvatarState` 是唯一真相源，`viewerSync` 把差异推给 3D 层
- `src/data/` manifest 校验、保存记录
- `src/components/` 页面与面板
- `scripts/` 素材脚本
- `tests/` Vitest 单元测试

## 部署

`npm run build` 后把 `dist/` 连同 `public/avatar/` 生成的模型一起静态托管即可，没有后端。注意模型文件不在 git 里，部署机器上要先跑一次 `assets:build`，或把 `dist/avatar/` 整体拷过去。
```

- [ ] **Step 2: 完整构建与压缩验证**

Run: `cd "G:/xuexi/2023/avatar-dressup" && npm run build && npm run assets:build -- --optimize && npm run build`
Expected: 两次构建都成功；第二次 `assets:build` 打印同样的槽位数量；`dist/avatar/manifest.json` 存在。再用 `npm run preview` 打开预览地址截图确认页面能换装。

- [ ] **Step 3: 提交**

```bash
cd "G:/xuexi/2023/avatar-dressup" && git add -A && git commit -m "docs: README 开发流程与部署说明" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## 自检记录

- 设计文档覆盖：第 3 节技术选型 → Task 1；第 5 节目录 → Task 1 与各任务；第 6 节数据模型 → Task 2、4、8；第 7 节 3D 规则 → Task 6、7；第 8 节 UI → Task 10、11；第 9 节资产流水线 → Task 5；第 10 节旧仓库处置 → Task 1 Step 12；第 11 节错误处理 → Task 6（PartBindError）、Task 8（onError 回滚）、Task 10（fatal、格子置灰）、Task 11（IndexedDB 不可用禁用保存）；第 12 节测试 → 每个任务；第 13 节里程碑 → M0 = Task 1 与 5，M1 = Task 6、7、10 Step 7，M2 = Task 8、9、10 Step 8，M3 = Task 11，收尾 = Task 12。
- 与设计文档的有意差异：保存记录 `parts` 统一为 `string[]`；卸下部件不释放共享几何体；`--optimize` 不做贴图缩放。三处都已在对应任务里注明。
- 类型一致性：`GltfSource.load` 返回 `LoadedGltf`，`PartLoader.load` 返回 `GLTF`（其 `scene: Group`、`animations: AnimationClip[]` 满足 `LoadedGltf`）；`AvatarViewer` 的方法集合覆盖 `ViewerLike`；`AvatarStore.state.avatar` 是 `AvatarState`，`viewerSync` 的 `diffEquipped` 接受 `Record<string, string[]>`。
