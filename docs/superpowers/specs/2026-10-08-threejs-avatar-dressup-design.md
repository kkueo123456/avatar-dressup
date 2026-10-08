# three.js 虚拟人换装 新项目设计

日期：2026-10-08
状态：待用户评审（第 2 版：由「在旧仓库内重写」改为「新建项目」）
范围：第一阶段，仅换装。文生图/图生图是第二阶段，另开设计。
本文档先放在旧仓库，新项目建好后迁入新仓库的 `docs/superpowers/specs/`，旧仓库里的这次提交随后移除。

## 1. 背景

旧仓库 `sass-fore-end-v2` 是「Meta48 生成式 AI 社区」的前端（Vue 3 + Vite + ant-design-vue），换装功能依赖两样已经不存在的东西：

- 内网后端 `10.25.20.15:8001`，`src/api/api.js` 里的 41 个接口和所有模型、贴图、动画文件都由它提供。
- Unity WebGL 编译包 `public/AnimtionPlay/`，换装逻辑在包内，仓库里没有 Unity 工程源码。

原素材是 Ready Player Me 的部件，该服务已于 2026-01-31 关停，无法再获取。旧仓库内经核实没有任何 glb/gltf/fbx/vrm/obj 文件。旧仓库要删的东西远多于要留的，因此决定新建项目，旧仓库原样保留。

## 2. 目标与非目标

目标：

- 一个单页应用，打开即进入换装页，用 three.js 渲染一个可按部位换装的 3D 人物。
- 素材来自 Quaternius 的「Universal Base Characters」与「Modular Character Outfits - Fantasy」，所有部件共用同一副 65 关节骨骼。
- 支持保存、恢复、截图，播放一个待机动画。
- 不依赖任何后端，数据是一份静态 manifest。

非目标（本阶段不做）：

- 捏脸、表情、BVH/视频驱动动作、动作上传。
- 账号、社区列表、收藏、消息、积分。
- 文生图、图生图。
- 移动端适配，目标是桌面浏览器，宽度 1280 以上。
- 把生成的形象导出为 glb/fbx 文件。

## 3. 技术选型

- 位置：`G:\xuexi\2023\avatar-dressup`，与旧仓库平级，独立 git 仓库。
- 构建：Vite 最新版，`create-vue` 模板，TypeScript 严格模式。
- 框架：Vue 3 组合式 API，`<script setup lang="ts">`。不用 vue-router（只有一个页面），不用状态库（一个组合式函数够用），不用 ant-design-vue（面板、抽屉、弹窗自己写）。
- 3D：three 最新版 + `@types/three`。
- 存储：`idb-keyval`。
- 测试：Vitest。
- 资产脚本：Node 22，脚本写成 `.mjs` 并用 JSDoc 标注类型，避免 TS 运行时配置；依赖 `@gltf-transform/core`、`@gltf-transform/functions`、`fast-glob`。
- 从旧仓库复制的东西只有一样：`src/assets/bodyColorConfig.less` 里的四套主题 CSS 变量，精简后放到 `src/styles/theme.css`。部位图标用内联 SVG 新画，不依赖旧图标。

## 4. 总体架构

```
浏览器
 ├─ Vue 组件层        DressUp.vue / TopBar.vue / PartsPanel.vue / SavesDrawer.vue / BaseSelect.vue / NameDialog.vue
 │     只管 UI 和状态，不直接碰 three 对象
 ├─ 状态层            src/state/useAvatarState.ts  当前底模、各槽位部件、贴图变体
 ├─ 3D 层             src/avatar/*  纯 three.js，不 import Vue
 ├─ 数据层            src/data/manifest.ts  读取并校验 public/avatar/manifest.json
 │                    src/data/saves.ts     IndexedDB 保存/恢复
 └─ 静态资源          public/avatar/manifest.json, models/, textures/, anim/
```

层间约定：

- 组件层通过 `AvatarViewer` 的方法调用 3D 层：`setBase(base)`、`equip(slot, part)`、`unequip(slotId, partId?)`、`setVariant(partId, variant)`、`focus('head' | 'body')`、`playAnimation(anim)`、`screenshot()`。参数是已解析好的 manifest 对象，3D 层不自己读 manifest。
- 3D 层通过事件回传：`loading(start | end, partId)`、`error(partId, reason)`。
- 状态层是唯一真相源，组件层改状态，由一个 watcher 把状态差异同步到 3D 层。

## 5. 目录结构

```
avatar-dressup/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .gitignore                        含 assets-src/、public/avatar/models/、public/avatar/textures/、public/avatar/anim/
  docs/superpowers/specs/           本文档
  assets-src/                       用户解压的原始素材，不进 git
    base/  outfits/  anim/
  public/avatar/
    manifest.json                   脚本输出，进 git
    models/  textures/  anim/       脚本输出，不进 git（体积大，可随时重新生成）
  scripts/
    build-manifest.mjs              扫描 assets-src/ 生成 manifest 并复制资源
    manifest.config.mjs             目录到槽位的映射表
  src/
    main.ts
    App.vue                         只渲染 DressUp
    types/manifest.ts               Manifest、BaseModel、Slot、Part、Variant、Preset、AnimationRef
    types/save.ts                   SaveRecord
    avatar/AvatarViewer.ts          场景、相机、灯光、渲染循环、resize、截图、相机聚焦
    avatar/AvatarRig.ts             底模加载、骨骼克隆、按骨骼名重绑、槽位装卸、底模可见性
    avatar/PartLoader.ts            GLTFLoader 封装：缓存、并发去重、释放
    avatar/ThumbnailRenderer.ts     离屏渲染部件缩略图，IndexedDB 缓存
    avatar/slotRules.ts             纯函数：槽位规则、预设补全、底模可见性判断
    state/useAvatarState.ts
    data/manifest.ts                fetch + 校验
    data/saves.ts                   idb-keyval 读写
    components/DressUp.vue          页面：左视口 + 右面板
    components/TopBar.vue           logo、主题切换、重置、保存、我的形象
    components/PartsPanel.vue       部位图标条 + 部件网格 + 变体色块
    components/SavesDrawer.vue
    components/BaseSelect.vue
    components/NameDialog.vue
    styles/theme.css                四套主题 CSS 变量
    styles/base.css
  tests/
    slotRules.test.ts  manifest.test.ts  saves.test.ts
```

## 6. 数据模型

### 6.1 类型定义（src/types/manifest.ts）

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
  id: string; sex: Exclude<Sex, 'any'>; label: string; url: string
  bodyMeshes: string[]      // 会被服装隐藏的网格名
  headMeshes: string[]      // 永远可见的网格名
}
export interface Slot {
  id: string; label: string; group: SlotGroup
  multiple: boolean         // 配饰为 true
  outfit: boolean           // body/arms/legs/feet 为 true
}
export interface Variant { id: string; label: string; textures: { map: string } }
export interface Part {
  id: string; slot: string; set: string | null; label: string; sex: Sex; url: string
  variants: Variant[]
}
export interface Preset { id: string; label: string; parts: Record<string, string> }
export interface AnimationRef { id: string; label: string; url: string; clip: string }
```

### 6.2 manifest.json 示例

```json
{
  "version": 1,
  "skeleton": { "rootBone": "root", "expectedBones": 65 },
  "bases": [
    { "id": "female_regular", "sex": "female", "label": "女性 · 常规",
      "url": "models/base/Female_Regular.glb",
      "bodyMeshes": ["Body"], "headMeshes": ["Head", "Eyes", "Teeth"] }
  ],
  "slots": [
    { "id": "hair",      "label": "发型", "group": "head",   "multiple": false, "outfit": false },
    { "id": "eyebrows",  "label": "眉毛", "group": "head",   "multiple": false, "outfit": false },
    { "id": "body",      "label": "上身", "group": "outfit", "multiple": false, "outfit": true  },
    { "id": "arms",      "label": "手臂", "group": "outfit", "multiple": false, "outfit": true  },
    { "id": "legs",      "label": "腿部", "group": "outfit", "multiple": false, "outfit": true  },
    { "id": "feet",      "label": "鞋靴", "group": "outfit", "multiple": false, "outfit": true  },
    { "id": "accessory", "label": "配饰", "group": "outfit", "multiple": true,  "outfit": false }
  ],
  "parts": [
    { "id": "ranger_body", "slot": "body", "set": "ranger", "label": "游侠上衣", "sex": "any",
      "url": "models/outfits/ranger/Ranger_Body.glb",
      "variants": [ { "id": "a", "label": "A", "textures": { "map": "textures/ranger/Ranger_A.png" } } ] }
  ],
  "presets": [
    { "id": "ranger", "label": "游侠",
      "parts": { "body": "ranger_body", "arms": "ranger_arms", "legs": "ranger_legs", "feet": "ranger_feet" } }
  ],
  "animations": [ { "id": "idle", "label": "待机", "url": "anim/Idle.glb", "clip": "Idle" } ]
}
```

字段说明：

- `bodyMeshes`、`headMeshes` 的网格名由脚本读取 glb 节点名填入。
- `slots[].group` 决定选中该槽位时相机聚焦头部还是全身。
- `slots[].outfit` 为 true 的四个槽位参与「底模可见性」和「预设补全」规则。
- `parts[].sex` 用于按当前底模性别过滤。
- `variants` 可为空数组。`textures` 第一版只有 `map`。
- 缩略图不写进 manifest，由运行时生成并缓存。

### 6.3 保存记录（src/types/save.ts）

```ts
export interface SaveRecord {
  id: string; name: string; createdAt: string; manifestVersion: number
  baseId: string
  parts: Record<string, string | string[]>   // 单选槽位是 string，多选槽位是 string[]
  variants: Record<string, string>           // partId -> variantId
  thumbnail: string                          // data:image/jpeg;base64
}
```

存于 IndexedDB，库名 `avatar-dressup`，key `saves`，值为 `SaveRecord[]`。缩略图 384x576 JPEG 质量 0.8。恢复时若某个 partId 已不在 manifest 中，跳过该部件并提示，不整体失败。

### 6.4 应用状态（src/state/useAvatarState.ts）

```ts
interface AvatarState {
  baseId: string
  equipped: Record<string, string[]>   // slotId -> partId[]，单选槽位数组长度 0 或 1
  variants: Record<string, string>
  activeSlot: string
}
```

对外暴露：`setBase`、`equip`、`unequip`、`clearSlot`、`applyPreset`、`setVariant`、`reset`、`toSave()`、`loadSave(record)`。所有规则调用 `slotRules.ts` 的纯函数。

## 7. 3D 核心规则

### 7.1 底模与骨骼

1. GLTFLoader 加载底模，`SkeletonUtils.clone(gltf.scene)` 得到角色实例，避免污染加载器缓存。
2. 从实例里任一 SkinnedMesh 取 `skeleton`，作为角色唯一骨骼，建立 `boneByName: Map<string, Bone>`。骨骼数与 `expectedBones` 不符只警告。
3. 角色根节点 `rig.root` 加入场景，所有部件都挂在它下面。

### 7.2 装上一个部件

1. 通过 PartLoader 取得部件 gltf（有缓存则复用），对 `gltf.scene` 做 `SkeletonUtils.clone`。
2. 遍历其中每个 SkinnedMesh `m`：
   - `bones = m.skeleton.bones.map(b => boneByName.get(b.name))`，任一为空则记录缺失骨骼名，整件部件放弃并上报 `error`。
   - `skeleton = new Skeleton(bones, m.skeleton.boneInverses)`，`m.bind(skeleton, bindMatrix)`。`bindMatrix` 先用单位矩阵，M1 验证；若部件文件内网格自带非单位变换则改用其原始 `matrixWorld`。
   - `m.frustumCulled = false`。
   - 把 `m` 加到 `rig.root`，部件自带的骨架节点不加入场景。
3. 记录 `partId -> meshes`，供卸下时使用。

### 7.3 卸下部件

从 `rig.root` 移除对应网格，释放几何体和未被其他部件共享的材质与贴图。PartLoader 的 gltf 缓存保留。

### 7.4 底模可见性

`bodyMeshes` 可见 当且仅当 四个 `outfit: true` 的槽位全部为空。头部网格始终可见。纯函数 `computeBodyVisible(state, slots): boolean`。

### 7.5 预设补全

四个服装槽位全空、用户装上第一件服装部件时，自动把同一 `set` 的其余三个槽位补满。之后可逐槽位混搭。纯函数 `fillOutfitFromSet(state, part, parts): AvatarState`。选择预设等价于依次装四件。

### 7.6 贴图变体

切换变体只替换对应材质的 `map`：TextureLoader 加载 PNG，`colorSpace = SRGBColorSpace`、`flipY = false`，旧贴图不再被引用则 dispose。不重新加载模型。

### 7.7 相机、灯光、动画

- PerspectiveCamera 50°，OrbitControls，禁止平移，距离 1.2 到 5。
- 全身聚焦目标取骨骼包围盒中心；头部聚焦目标取 `head` 骨骼世界坐标。切换在渲染循环里用 400ms 线性插值，不引入 tween 库。
- 半球光 + 一盏带阴影的方向光，环境贴图用 `RoomEnvironment`，地面一块接收阴影的圆盘。背景色读 CSS 变量，随主题切换。
- 动画：加载 `animations[0]` 的 glb，`AnimationMixer(rig.root)` 循环播放 `clip` 名的剪辑。

### 7.8 截图

`screenshot()` 把渲染器临时设为 512x768、清屏色为当前背景色，渲染一帧后立即 `toDataURL('image/jpeg', 0.8)`，再恢复原尺寸。不开启 `preserveDrawingBuffer`。

## 8. UI 与交互

- 布局：左侧 3D 视口自适应，右侧 560px 面板，顶栏 64px。
- 面板顶部是部位图标条，顺序与 `slots` 一致；没有任何部件的槽位不显示。
- 面板主体是部件网格。第一格固定为「无」用于卸下（多选槽位除外）。每格显示缩略图，未就绪时显示部件名称。已装部件高亮。
- 部件有变体时，网格下方出现变体色块行。
- 底模切换是独立下拉框，切换后保留能匹配的部件，性别不匹配的部件卸下并提示。
- 顶栏按钮：主题切换、重置、保存（弹出命名框，截图后写入）、我的形象（打开抽屉）。
- 抽屉按时间倒序列出记录，点击恢复，支持删除，上限 50 条，满了提示先删。
- 加载中的格子显示转圈，失败的格子置灰并带错误提示。

## 9. 资产流水线

### 9.1 来源与下载

| 包 | 地址 | 需要的文件 | 免费层 |
|---|---|---|---|
| Universal Base Characters | https://quaternius.itch.io/universal-base-characters | Standard zip | 2 个底模 + 5 个发型 |
| Modular Character Outfits - Fantasy | https://quaternius.itch.io/modular-character-outfits-fantasy | Standard zip | Ranger、Peasant 两套 |
| Universal Animation Library | https://quaternius.itch.io/universal-animation-library | Standard zip | 45 个动画 |

下载方式：页面点「Download Now」，在付费对话框选「No thanks, just take me to the downloads」。许可以 zip 内 LICENSE 文件为准，itch 页面标注为 CC0。解压到 `assets-src/base/`、`assets-src/outfits/`、`assets-src/anim/`。下载包只作为数据被脚本读取，不执行其中任何内容。

### 9.2 build-manifest 脚本

`node scripts/build-manifest.mjs [--optimize]`

1. 按 `scripts/manifest.config.mjs` 的映射表扫描 `assets-src/`。映射表形如 `{ glob: 'outfits/**/Ranger_Body.glb', slot: 'body', set: 'ranger', label: '游侠上衣', sex: 'any' }`，具体条目等素材解压后按真实文件名填写。
2. 用 `@gltf-transform/core` 打开每个 glb，读取网格名、骨骼数，骨骼数不等于 65 时输出警告。
3. 复制 glb 及其 .bin、贴图到 `public/avatar/`，路径写入 manifest。
4. `--optimize` 时用 gltf-transform 做 `dedup`、`prune`，并把贴图缩到 1024。默认关闭。
5. 输出 `public/avatar/manifest.json`，并打印每个槽位的部件数量。

## 10. 旧仓库处置

- `sass-fore-end-v2` 源码不改。
- 新仓库建好后，本文档迁入新仓库，旧仓库里的文档提交用一次 `git revert` 撤掉。
- 旧仓库里可复用的只有主题 CSS 变量。`public/envMap/` 立方体贴图不复制，`public/mixamoani/Idle.txt` 与 Quaternius 骨骼不兼容，`public/skeletonMap/` 是旧流水线映射表，均不复制。
- 第二阶段做生图时，旧仓库的 `editImgComp.vue` 和 `made.vue` 可作为 UI 参考，但在新项目里用 TS 重写。

## 11. 错误处理

- manifest 校验失败：页面显示错误和原因，不渲染 3D。
- 底模加载失败：同上。
- 部件加载失败或骨骼名缺失：该格子置灰，提示包含缺失骨骼名的前三个，其余部件不受影响。
- WebGL 不可用：显示提示文字。
- IndexedDB 不可用：缩略图不缓存，保存功能禁用并提示。

## 12. 测试

单元测试（Vitest，纯函数，不碰 WebGL）：

- `slotRules.test.ts`：底模可见性、预设补全、多选槽位装卸、底模切换时的性别过滤。
- `manifest.test.ts`：缺字段、未知 slot、重复 id、part 引用不存在的 slot 时的校验结果。
- `saves.test.ts`：序列化往返、manifest 版本不匹配时的部件跳过（用内存版 idb-keyval 替身）。

类型检查：`vue-tsc --noEmit` 作为 `npm run typecheck`。

人工验证（内置浏览器截图）：

- M1：底模渲染正确，换上一件上衣后无穿模、无骨骼错位，动画播放时衣服跟随。
- M2：七个槽位切换，预设一键换装，缩略图生成。
- M3：保存后刷新页面能恢复，截图正确，变体切换生效。

## 13. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M0 | 新建项目骨架（Vite + Vue 3 + TS、主题变量、空页面）；用户下载解压素材；填写映射表；脚本生成 manifest；本文档迁入并撤销旧仓库提交 | `npm run dev` 能打开空页面；`public/avatar/manifest.json` 生成，每槽位数量正确 |
| M1 | 类型定义、manifest 读取校验、AvatarViewer、AvatarRig、PartLoader；页面渲染底模并换一件上衣；底模身体隐藏 | 浏览器截图确认 |
| M2 | slotRules、useAvatarState、PartsPanel、BaseSelect、预设、缩略图 | 单测与类型检查通过，浏览器确认 |
| M3 | saves、SavesDrawer、NameDialog、截图、Idle 动画、贴图变体 | 单测通过，刷新后恢复成功 |
| 收尾 | README、`npm run build` 通过、`--optimize` 验证一次 | 构建产物可直接静态托管 |

## 14. 已知风险

- 免费层素材可能缺少某些槽位的部件（如眉毛），面板会隐藏空槽位，不影响流程。
- 绑定矩阵假设为单位矩阵，M1 若发现错位则改用原始世界矩阵。
- 贴图变体文件的组织方式要等解压后确认，映射表可能需要为每个变体单独写路径。
- `@types/three` 与 three 版本需配对，升级时一起升。
- Quaternius 许可以下载包内 LICENSE 为准。
