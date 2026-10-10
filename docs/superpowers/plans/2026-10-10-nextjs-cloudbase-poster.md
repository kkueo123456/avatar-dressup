# 子项目 A：Next.js 迁移、换装页、假海报、云托管部署 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 Vite 加 Vue 的换装项目原地迁移到 Next.js 16，做出首页介绍页与 `/create` 换装页，加一个走服务端假适配器的「生成海报」功能，部署到腾讯云云托管。

**Architecture:** 3D 层（AvatarRig、AvatarViewer、rebind、PartLoader、ThumbnailRenderer）和规则层（slotRules）保持纯 TypeScript、不依赖框架；状态层换成 zustand 的 vanilla store，viewerSync 用 `store.subscribe` 把状态差分推给 viewer；页面用 React 19 客户端组件；海报走 `app/api/poster` 路由，适配器接口一个方法，第一版只有 sharp 实现的假适配器。

**Tech Stack:** Next.js 16.4、React 19.3、TypeScript 严格模式、zustand 5、three 0.186、sharp 0.35、@gltf-transform 4.5、subset-font、vitest 5、Docker、@cloudbase/cli。

**Spec:** `docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md`

## Global Constraints

- 在 `dev` 分支上工作，原仓库原地迁移，不新建仓库。
- 版本：next 16.4、react 19.3、react-dom 19.3、zustand 5.0、sharp 0.35、three 0.186.1、@types/three 0.186、typescript 6.x、vitest 5.0。本机 Node 22.14。
- 3D 层不 import React 或 Next；组件只改 store，不直接调 viewer 的装卸方法（截图、聚焦除外）。
- 删除贴图变体与底模身体隐藏的全部运行时逻辑；manifest 的 `variants` 字段保留为空数组；`BaseModel` 去掉 `bodyMeshes`、`headMeshes`；`SaveRecord` 去掉 `variants`。
- 设计令牌固定：--ground #0F0E14、--panel #13121A、--card #1B1A23、--line #2A2834、--line-hover #3A3846、--text #EFEDF3、--muted #A09DAE、--accent #E8A445、--on-accent #1A1206、--ai #AE98F2、--ok #6FCF97、--warn #F2C94C、--error #EB7A7A。单主题暗色。
- 字体：Orbitron 600/700 与站酷庆科黄油体自托管在 `app/fonts/`，正文用系统中文黑体栈。不用 Google Fonts 运行时链接。
- 海报接口契约：`POST /api/poster`，JSON `{ image: "data:image/jpeg;base64,...", style }`，风格枚举 `fantasy | anime | watercolor | cyberpunk`；200 返回 `image/jpeg`；400 文案固定为「图片必须是 JPEG data URL」「图片超过 4 MB」「未知风格」；500 文案「海报服务未配置: POSTER_PROVIDER=<值>」。
- 截图 768 乘 1152，JPEG 质量 0.85。
- 所有界面文案中文；标题用站酷庆科黄油体，字标用 Orbitron。
- 路由：`/` 首页，`/create` 换装页。首页不 import three、store、manifest。
- 部署：`output: 'standalone'`，云托管 0.25 核 0.5 GB，高可用模式最小副本 1，默认域名。
- 每个任务结束时 `npm test` 与 `npm run typecheck` 通过，然后提交。提交信息末尾加 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`。

## Review Focus

- 海报请求体不是 JSON、或 `image` 不是 JPEG data URL：用户应看到固定文案的 400，不是 500。测试在 Task 8（`parsePosterRequest`）与 Task 9（路由）。
- 图片超过 4 MB：400，且不会进入适配器（不浪费服务端 CPU）。测试在 Task 8。
- `POSTER_PROVIDER` 未设置或拼错：500 带说明，不能静默回退到假适配器。测试在 Task 8（`getPosterProvider`）。
- `NEXT_PUBLIC_ASSET_BASE` 带或不带尾部斜杠、传入路径带或不带前导斜杠，拼出来的 URL 都只有一个斜杠。测试在 Task 3（`assetUrl`）。
- 资源脚本：Outfits 整套文件、Origin at 0 的静态发型、带 `_RM` 的根运动动画都不能进 manifest。测试在 Task 5（classify）。

## 文件结构

| 路径 | 职责 | 处理 |
|---|---|---|
| `src/avatar/AvatarRig.ts` | 底模、骨骼重绑、装卸、动画 | 修改：去变体、去身体隐藏 |
| `src/avatar/AvatarViewer.ts` | 渲染器、相机、灯光、聚焦、截图 | 修改：去变体、去身体隐藏、背景色由构造参数传入 |
| `src/avatar/ThumbnailRenderer.ts` | 离屏缩略图 | 修改：去 idb-keyval，只留内存缓存 |
| `src/avatar/rebind.ts`、`PartLoader.ts` | 骨骼重绑、加载缓存 | 不动 |
| `src/avatar/slotRules.ts` | 规则纯函数 | 修改：去变体、去 computeBodyVisible |
| `src/types/manifest.ts`、`save.ts` | 类型 | 修改 |
| `src/data/manifest.ts` | 校验 | 修改：去两个字段的检查 |
| `src/data/saves.ts` | 存档序列化 | 修改：只留两个纯函数 |
| `src/data/assetUrl.ts` | 资源 URL | 修改：读环境变量 |
| `src/state/avatarStore.ts` | zustand store 与 selector | 新建，替换 `useAvatarState.ts` |
| `src/state/viewerSync.ts` | 状态到 3D 的同步 | 修改：subscribe 版 |
| `src/poster/types.ts`、`request.ts`、`mock.ts`、`index.ts` | 海报适配器、请求校验 | 新建 |
| `app/layout.tsx`、`app/page.tsx`、`app/create/page.tsx`、`app/globals.css`、`app/api/poster/route.ts` | Next 路由 | 新建 |
| `components/*.tsx`、`components/landing/*.tsx` | 页面组件 | 新建 |
| `scripts/build-fonts.mjs` | 字体子集化 | 新建 |
| `scripts/build-manifest.mjs`、`lib/classify.mjs`、`manifest.config.mjs` | 资源脚本 | 修改 |
| `Dockerfile`、`.npmrc`、`next.config.ts`、`vitest.config.ts`、`tsconfig.json`、`package.json` | 配置 | 新建或重写 |
| `index.html`、`vite.config.ts`、`src/main.ts`、`src/App.vue`、`src/env.d.ts`、`src/styles/`、`src/state/useAvatarState.ts`、`tests/useAvatarState.test.ts` | Vite 与 Vue 残留 | 删除 |

---

### Task 1: 3D 层去变体与身体隐藏

**Files:**
- Modify: `src/avatar/AvatarRig.ts`
- Modify: `src/avatar/AvatarViewer.ts`
- Modify: `src/avatar/ThumbnailRenderer.ts`
- Modify: `tests/avatarRig.test.ts`

**Interfaces:**
- Consumes: `GltfSource`、`LoadedGltf`（`src/avatar/PartLoader.ts`，不变）；`rebindToSkeleton`、`buildBoneMap`、`collectSkinnedMeshes`（`src/avatar/rebind.ts`，不变）。
- Produces:
  - `class AvatarRig { constructor(source: GltfSource, resolveUrl: (p: string) => string); root: Group; hasBase; boneCount; equippedIds: string[]; getBone(name); isEquipped(id); setBase(base: BaseModel): Promise<void>; equip(part: Part): Promise<void>; unequip(partId: string): void; playAnimation(anim: AnimationRef): Promise<void>; stopAnimation(); update(delta: number); getBounds(target?: Box3): Box3; getHeadWorldPosition(target?: Vector3): Vector3 | null }`
  - `class AvatarViewer { constructor(container: HTMLElement, resolveUrl: (p: string) => string, options: { background: string }); on(event, fn); resize(); focus(target: 'head' | 'body'); setBase; equip; unequip; playAnimation; screenshot(width = 768, height = 1152, quality = 0.85): string; dispose() }`
  - `class ThumbnailRenderer { constructor(source: GltfSource, resolveUrl: (p: string) => string, size = 128); get(part: Part): Promise<string>; dispose() }`

- [ ] **Step 1: 改写 rig 测试，去掉身体可见与变体用例**

把 `tests/avatarRig.test.ts` 整个替换为：

```ts
import { describe, expect, it, vi } from 'vitest'
import { Skeleton, type SkinnedMesh } from 'three'
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
  it('setBase 后有骨骼', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    expect(rig.hasBase).toBe(true)
    expect(rig.boneCount).toBe(4)
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

  it('equip 给每个网格一份独立材质，不动加载器缓存', async () => {
    const { rig, src } = setup()
    await rig.setBase(female)
    const p = part(m, 'ranger_body')
    const cached = collectSkinnedMeshes(src.files.get(url(p.url))!.scene)[0]
    await rig.equip(p)
    expect(partMeshes(rig)[0].material).not.toBe(cached.material)
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

  it('换底模会清掉所有部件', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'ranger_body'))
    await rig.setBase(male)
    expect(rig.equippedIds).toEqual([])
    expect(rig.boneCount).toBe(4)
    expect(partMeshes(rig)).toEqual([])
  })

  it('unequip 释放部件骨架', async () => {
    const spy = vi.spyOn(Skeleton.prototype, 'dispose')
    try {
      const { rig } = setup()
      await rig.setBase(female)
      await rig.equip(part(m, 'ranger_body'))
      spy.mockClear()
      rig.unequip('ranger_body')
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/avatarRig.test.ts`
Expected: FAIL，`equip 给每个网格一份独立材质` 能过，但其余至少一条因 `rig.setBase` 读取 `base.bodyMeshes` 的逻辑仍在而行为不同；无论如何，继续 Step 3 后再看全绿。

- [ ] **Step 3: 重写 AvatarRig.ts**

整个文件替换为：

```ts
import {
  AnimationClip, AnimationMixer, type Bone, Box3, Group, LoopRepeat, type Material,
  type Mesh, type Object3D, type Skeleton, type SkinnedMesh, Vector3,
} from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
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
}

export class AvatarRig {
  readonly root = new Group()
  private skeleton: Skeleton | null = null
  private boneByName = new Map<string, Bone>()
  private baseScene: Object3D | null = null
  private readonly equipped = new Map<string, EquippedPart>()
  private readonly pending = new Set<string>()
  private mixer: AnimationMixer | null = null
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
    })
    this.baseScene = scene
    this.root.add(scene)
    this.mixer = new AnimationMixer(scene)
  }

  private clearAll(): void {
    for (const id of [...this.equipped.keys()]) this.unequip(id)
    this.pending.clear()
    if (this.baseScene) {
      for (const m of collectSkinnedMeshes(this.baseScene)) m.skeleton.dispose()
      this.root.remove(this.baseScene)
      this.baseScene = null
    }
    this.mixer?.stopAllAction()
    this.mixer = null
    this.skeleton = null
    this.boneByName = new Map()
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
    for (const mesh of meshes) {
      // 材质复制一份：缩略图渲染器和主视口共用加载器缓存，不能改原件
      mesh.material = (mesh.material as Material).clone()
      mesh.castShadow = true
      this.root.add(mesh)
    }
    this.equipped.set(part.id, { meshes })
  }

  unequip(partId: string): void {
    this.pending.delete(partId)
    const entry = this.equipped.get(partId)
    if (!entry) return
    for (const mesh of entry.meshes) {
      this.root.remove(mesh)
      mesh.skeleton.dispose()
      ;(mesh.material as Material).dispose()
    }
    this.equipped.delete(partId)
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

- [ ] **Step 4: 跑 rig 测试确认通过**

Run: `npx vitest run tests/avatarRig.test.ts`
Expected: 9 passed。

- [ ] **Step 5: 修改 AvatarViewer.ts**

把构造函数签名改为三个参数，并删除三个方法。具体改动：

构造函数头部，原

```ts
  constructor(
    private readonly container: HTMLElement,
    resolveUrl: (p: string) => string,
  ) {
```

改为

```ts
  constructor(
    private readonly container: HTMLElement,
    resolveUrl: (p: string) => string,
    options: { background: string },
  ) {
```

构造函数末尾，原

```ts
    this.applyBackgroundFromCss()
    this.resizeObserver = new ResizeObserver(() => this.resize())
```

改为

```ts
    this.scene.background = new THREE.Color(options.background)
    this.resizeObserver = new ResizeObserver(() => this.resize())
```

删除整个 `applyBackgroundFromCss()` 方法、整个 `setBodyVisible()` 方法、整个 `setVariant()` 方法。把 import 行里的 `Variant` 去掉：

```ts
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
```

把 `screenshot` 的默认参数改为

```ts
  screenshot(width = 768, height = 1152, quality = 0.85): string {
```

- [ ] **Step 6: 重写 ThumbnailRenderer.ts**

整个文件替换为：

```ts
import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import type { Part } from '@/types/manifest'
import type { GltfSource } from './PartLoader'

/** 离屏渲染部件缩略图，按部件 id 做内存缓存；页面刷新后重新渲染 */
export class ThumbnailRenderer {
  private renderer: THREE.WebGLRenderer | null = null
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50)
  private readonly memory = new Map<string, Promise<string>>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly source: GltfSource,
    private readonly resolveUrl: (p: string) => string,
    private readonly size = 128,
  ) {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2)
    key.position.set(1, 2, 2)
    this.scene.add(key)
  }

  get(part: Part): Promise<string> {
    const hit = this.memory.get(part.id)
    if (hit) return hit
    const run = () => this.render(part)
    const p = this.queue.then(run, run)
    this.queue = p.catch(() => undefined)
    const stored = p.catch((e: unknown) => {
      this.memory.delete(part.id)
      throw e
    })
    this.memory.set(part.id, stored)
    return stored
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
    try {
      obj.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(obj, true)
      const center = box.getCenter(new THREE.Vector3())
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05)
      const dist = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.1
      this.camera.position.set(center.x + dist * 0.4, center.y + dist * 0.3, center.z + dist * 0.85)
      this.camera.lookAt(center)
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/png')
    } finally {
      this.scene.remove(obj)
    }
  }

  dispose(): void {
    this.renderer?.dispose()
    this.renderer = null
    this.memory.clear()
  }
}
```

- [ ] **Step 7: 跑全部测试与类型检查**

Run: `npm test && npm run typecheck`
Expected: 全部通过。`idb-keyval` 此时仍被 `saves.ts` 用着，Task 2 再删。

- [ ] **Step 8: 提交**

```bash
git add src/avatar/AvatarRig.ts src/avatar/AvatarViewer.ts src/avatar/ThumbnailRenderer.ts tests/avatarRig.test.ts
git commit -m "refactor: 3D 层去掉贴图变体与底模身体隐藏

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 规则、类型、数据层去变体，状态层换 zustand

**Files:**
- Modify: `src/types/manifest.ts`、`src/types/save.ts`
- Modify: `src/avatar/slotRules.ts`、`src/data/manifest.ts`、`src/data/saves.ts`
- Create: `src/state/avatarStore.ts`
- Modify: `src/state/viewerSync.ts`
- Delete: `src/state/useAvatarState.ts`、`tests/useAvatarState.test.ts`
- Modify: `tests/fixtures/manifest.ts`、`tests/slotRules.test.ts`、`tests/saves.test.ts`、`tests/viewerSync.test.ts`
- Create: `tests/avatarStore.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `AvatarViewer` 方法集合（`setBase`、`equip`、`unequip`、`playAnimation`）。
- Produces:
  - `interface AvatarState { baseId: string; equipped: Record<string, string[]> }`
  - `slotRules`：`createEmptyState(manifest, baseId)`、`partFitsBase(part, base)`、`partsForSlot(manifest, slotId, base)`、`isOutfitEmpty(state, slots)`、`fillOutfitFromSet(state, part, manifest)`、`equipPart(state, part, manifest)`、`unequipPart(state, slotId, partId?)`、`applyPreset(state, preset, manifest)`、`changeBase(state, base, manifest): { state, removed: Part[] }`
  - `interface AvatarStoreState { avatar: AvatarState; activeSlot: string; equip(part: Part): void; unequip(slotId: string, partId?: string): void; toggle(part: Part): void; applyPreset(preset: Preset): void; setBase(base: BaseModel): Part[]; reset(): void; replace(next: AvatarState): void; setActiveSlot(id: string): void }`
  - `type AvatarStore = StoreApi<AvatarStoreState>`；`createAvatarStore(manifest: Manifest): AvatarStore`
  - selector：`selectBase(manifest, s): BaseModel`、`selectVisibleSlots(manifest, s): Slot[]`、`selectPartsInActiveSlot(manifest, s): Part[]`、`selectEquippedIds(s): string[]`、`selectEquippedCount(s): number`、`selectCurrentPreset(manifest, s): Preset | null`
  - `interface ViewerLike { setBase(base): Promise<void>; equip(part): Promise<void>; unequip(partId): void; playAnimation(anim): Promise<void> }`
  - `createViewerSync(store: AvatarStore, viewer: ViewerLike, manifest: Manifest, onError: (id: string, err: unknown) => void): { stop(): void; idle(): Promise<void> }`
  - `saves.ts`：`toSaveRecord(state, name, thumbnail, manifestVersion, now?)`、`fromSaveRecord(record, manifest): { state: AvatarState; skipped: string[] }`

- [ ] **Step 1: 安装 zustand，卸载 idb-keyval**

Run: `npm install zustand@5 && npm uninstall idb-keyval`
Expected: `package.json` dependencies 里出现 `"zustand": "^5.0.x"`，没有 `idb-keyval`。

- [ ] **Step 2: 改类型**

`src/types/manifest.ts` 里 `BaseModel` 改为：

```ts
export interface BaseModel {
  id: string
  sex: Exclude<Sex, 'any'>
  label: string
  url: string
}
```

`src/types/save.ts` 整个替换为：

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
  /** data:image/jpeg;base64,… */
  thumbnail: string
}
```

- [ ] **Step 3: 改 fixture**

`tests/fixtures/manifest.ts` 里 `bases` 两行改为：

```ts
    bases: [
      { id: 'female_regular', sex: 'female', label: '女性', url: 'models/base/Female.glb' },
      { id: 'male_regular', sex: 'male', label: '男性', url: 'models/base/Male.glb' },
    ],
```

其余不动（`variants` 字段保留，因为 manifest 结构仍有它）。

- [ ] **Step 4: 写 slotRules 的失败测试**

`tests/slotRules.test.ts` 整个替换为：

```ts
import { describe, expect, it } from 'vitest'
import {
  applyPreset, changeBase, createEmptyState, equipPart, isOutfitEmpty, partsForSlot, unequipPart,
} from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()
const female = m.bases[0]
const male = m.bases[1]

describe('createEmptyState', () => {
  it('每个槽位都是空数组，服装为空', () => {
    const s = createEmptyState(m, female.id)
    expect(Object.keys(s.equipped).sort()).toEqual(m.slots.map((x) => x.id).sort())
    expect(Object.values(s.equipped).every((v) => v.length === 0)).toBe(true)
    expect(isOutfitEmpty(s, m.slots)).toBe(true)
    expect('variants' in s).toBe(false)
  })
})

describe('equipPart', () => {
  it('服装全空时装第一件会补全同套其余三件', () => {
    const s0 = createEmptyState(m, female.id)
    const s1 = equipPart(s0, part(m, 'ranger_body'), m)
    expect(s1.equipped.body).toEqual(['ranger_body'])
    expect(s1.equipped.arms).toEqual(['ranger_arms'])
    expect(s1.equipped.legs).toEqual(['ranger_legs'])
    expect(s1.equipped.feet).toEqual(['ranger_feet'])
    expect(isOutfitEmpty(s1, m.slots)).toBe(false)
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
  it('卸下整个槽位', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    s = unequipPart(s, 'body')
    expect(s.equipped.body).toEqual([])
    expect(s.equipped.arms).toEqual(['ranger_arms'])
  })

  it('多选槽位只卸指定的一个', () => {
    let s = createEmptyState(m, female.id)
    s = equipPart(s, part(m, 'hood'), m)
    s = equipPart(s, part(m, 'pauldron'), m)
    s = unequipPart(s, 'accessory', 'hood')
    expect(s.equipped.accessory).toEqual(['pauldron'])
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

  it('预设里的部件性别不匹配时，换成同套同槽位里匹配底模的部件', () => {
    const mm = makeManifest()
    part(mm, 'ranger_body').sex = 'female'
    mm.parts.push({ ...part(mm, 'ranger_body'), id: 'ranger_body_m', sex: 'male' })
    const s = applyPreset(createEmptyState(mm, male.id), mm.presets[0], mm)
    expect(s.equipped.body).toEqual(['ranger_body_m'])
    expect(s.equipped.arms).toEqual(['ranger_arms'])
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

- [ ] **Step 5: 跑 slotRules 测试确认失败**

Run: `npx vitest run tests/slotRules.test.ts`
Expected: FAIL，`'variants' in s` 为 true。

- [ ] **Step 6: 重写 slotRules.ts**

整个文件替换为：

```ts
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'

export interface AvatarState {
  baseId: string
  /** slotId -> partId[]；单选槽位数组长度为 0 或 1 */
  equipped: Record<string, string[]>
}

export function createEmptyState(manifest: Manifest, baseId: string): AvatarState {
  const equipped: Record<string, string[]> = {}
  for (const s of manifest.slots) equipped[s.id] = []
  return { baseId, equipped }
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
  let next: AvatarState = { ...state, equipped: { ...state.equipped, [slot.id]: nextList } }
  if (slot.outfit && wasOutfitEmpty) next = fillOutfitFromSet(next, part, manifest)
  return next
}

export function unequipPart(state: AvatarState, slotId: string, partId?: string): AvatarState {
  const current = state.equipped[slotId] ?? []
  const nextList = partId === undefined ? [] : current.filter((id) => id !== partId)
  return { ...state, equipped: { ...state.equipped, [slotId]: nextList } }
}

/**
 * 整套替换四个服装槽位。预设里记录的是某一性别的部件 id；
 * 若该部件不匹配当前底模，就换成同套、同槽位、匹配底模的那件（资源脚本保证男女各有一套）。
 */
export function applyPreset(state: AvatarState, preset: Preset, manifest: Manifest): AvatarState {
  let next = state
  for (const slot of manifest.slots) if (slot.outfit) next = unequipPart(next, slot.id)
  const base = baseOf(next, manifest)
  const equipped = { ...next.equipped }
  for (const [slotId, partId] of Object.entries(preset.parts)) {
    const wanted = manifest.parts.find((x) => x.id === partId)
    if (!wanted || wanted.slot !== slotId) continue
    const p = !base || partFitsBase(wanted, base)
      ? wanted
      : manifest.parts.find((x) => x.slot === slotId && x.set === wanted.set && partFitsBase(x, base))
    if (p) equipped[slotId] = [p.id]
  }
  return { ...next, equipped }
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
  return { state: { baseId: base.id, equipped }, removed }
}
```

- [ ] **Step 7: 跑 slotRules 测试确认通过**

Run: `npx vitest run tests/slotRules.test.ts`
Expected: 12 passed。

- [ ] **Step 8: 改 manifest 校验**

`src/data/manifest.ts` 里底模循环中删除这两行：

```ts
    if (!isStrArr(b.bodyMeshes)) push(`底模 ${b.id} 的 bodyMeshes 必须是字符串数组`)
    if (!isStrArr(b.headMeshes)) push(`底模 ${b.id} 的 headMeshes 必须是字符串数组`)
```

`isStrArr` 之后没有别的调用方，连同它的定义一起删除：

```ts
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)
```

Run: `npx vitest run tests/manifest.test.ts`
Expected: 9 passed。

- [ ] **Step 9: 写 saves 的失败测试**

`tests/saves.test.ts` 整个替换为：

```ts
import { describe, expect, it } from 'vitest'
import { fromSaveRecord, toSaveRecord } from '@/data/saves'
import { createEmptyState, equipPart } from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()

function dressed() {
  let s = createEmptyState(m, 'female_regular')
  s = equipPart(s, part(m, 'ranger_body'), m)
  s = equipPart(s, part(m, 'hair_f'), m)
  s = equipPart(s, part(m, 'hood'), m)
  s = equipPart(s, part(m, 'pauldron'), m)
  return s
}

describe('toSaveRecord / fromSaveRecord', () => {
  it('往返后状态一致，包括多选槽位', () => {
    const s = dressed()
    const rec = toSaveRecord(s, '我的游侠', 'data:x', 1, new Date('2026-10-08T00:00:00Z'))
    expect(rec.createdAt).toBe('2026-10-08T00:00:00.000Z')
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/)
    expect('variants' in rec).toBe(false)
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
    expect(state.equipped.arms).toEqual(['ranger_arms'])
  })

  it('记录里的槽位已不存在时跳过该槽位的全部部件', () => {
    const rec = toSaveRecord(dressed(), 'old', '', 1)
    const mm = makeManifest()
    mm.slots = mm.slots.filter((s) => s.id !== 'accessory')
    const { state, skipped } = fromSaveRecord(rec, mm)
    expect(skipped.sort()).toEqual(['hood', 'pauldron'])
    expect('accessory' in state.equipped).toBe(false)
  })

  it('底模不存在时退回第一个底模并报告', () => {
    const rec = { ...toSaveRecord(dressed(), 'x', '', 1), baseId: 'ghost' }
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(state.baseId).toBe('female_regular')
    expect(skipped).toContain('ghost')
  })
})
```

- [ ] **Step 10: 重写 saves.ts**

整个文件替换为：

```ts
import type { Manifest } from '@/types/manifest'
import type { SaveRecord } from '@/types/save'
import { createEmptyState, type AvatarState } from '@/avatar/slotRules'

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
    thumbnail,
  }
}

/** 恢复时若部件、槽位或底模已不在 manifest 中，跳过并在 skipped 里报告，不整体失败 */
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
  return { state, skipped }
}
```

Run: `npx vitest run tests/saves.test.ts`
Expected: 4 passed。

- [ ] **Step 11: 写 avatarStore 的失败测试**

新建 `tests/avatarStore.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  createAvatarStore, selectBase, selectCurrentPreset, selectEquippedCount, selectEquippedIds,
  selectPartsInActiveSlot, selectVisibleSlots,
} from '@/state/avatarStore'
import { makeManifest, part } from './fixtures/manifest'

describe('createAvatarStore', () => {
  it('初始为第一个底模、全空、第一个槽位激活', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    const s = store.getState()
    expect(s.avatar.baseId).toBe('female_regular')
    expect(s.activeSlot).toBe('hair')
    expect(selectBase(m, s).id).toBe('female_regular')
    expect(selectPartsInActiveSlot(m, s).map((p) => p.id)).toEqual(['hair_f'])
    expect(selectVisibleSlots(m, s).map((x) => x.id)).toEqual(
      m.slots.map((x) => x.id).filter((id) => id !== 'eyebrows'),
    )
    expect(selectEquippedCount(s)).toBe(0)
    expect(selectCurrentPreset(m, s)).toBeNull()
  })

  it('每次动作都产生新的 avatar 对象，没动作时引用不变', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    const a0 = store.getState().avatar
    store.getState().setActiveSlot('body')
    expect(store.getState().avatar).toBe(a0)
    store.getState().equip(part(m, 'ranger_body'))
    expect(store.getState().avatar).not.toBe(a0)
  })

  it('toggle：单选槽位重复点击保持，多选槽位重复点击卸下', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().toggle(part(m, 'ranger_body'))
    store.getState().toggle(part(m, 'ranger_body'))
    expect(store.getState().avatar.equipped.body).toEqual(['ranger_body'])
    store.getState().toggle(part(m, 'hood'))
    store.getState().toggle(part(m, 'hood'))
    expect(store.getState().avatar.equipped.accessory).toEqual([])
    expect(selectEquippedIds(store.getState())).toContain('ranger_arms')
    expect(selectEquippedCount(store.getState())).toBe(4)
    expect(selectCurrentPreset(m, store.getState())?.id).toBe('ranger')
  })

  it('混搭后 selectCurrentPreset 为 null', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().applyPreset(m.presets[0])
    store.getState().equip(part(m, 'peasant_legs'))
    expect(selectCurrentPreset(m, store.getState())).toBeNull()
  })

  it('setBase 返回被卸下的部件并切换 partsInActiveSlot 的过滤', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().equip(part(m, 'hair_f'))
    const removed = store.getState().setBase(m.bases[1])
    expect(removed.map((p) => p.id)).toEqual(['hair_f'])
    expect(selectBase(m, store.getState()).id).toBe('male_regular')
    expect(selectPartsInActiveSlot(m, store.getState()).map((p) => p.id)).toEqual(['hair_m'])
  })

  it('reset 回到初始；replace 整体替换', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().equip(part(m, 'ranger_body'))
    store.getState().reset()
    expect(selectEquippedCount(store.getState())).toBe(0)
    store.getState().replace({ baseId: 'male_regular', equipped: { hair: ['hair_m'] } })
    expect(store.getState().avatar.baseId).toBe('male_regular')
    expect(store.getState().avatar.equipped.hair).toEqual(['hair_m'])
  })
})
```

- [ ] **Step 12: 跑确认失败**

Run: `npx vitest run tests/avatarStore.test.ts`
Expected: FAIL，找不到模块 `@/state/avatarStore`。

- [ ] **Step 13: 新建 avatarStore.ts**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'
import * as rules from '@/avatar/slotRules'
import type { AvatarState } from '@/avatar/slotRules'

export interface AvatarStoreState {
  avatar: AvatarState
  activeSlot: string
  equip(part: Part): void
  unequip(slotId: string, partId?: string): void
  toggle(part: Part): void
  applyPreset(preset: Preset): void
  /** 返回因性别不匹配被卸下的部件，供界面提示 */
  setBase(base: BaseModel): Part[]
  reset(): void
  replace(next: AvatarState): void
  setActiveSlot(id: string): void
}

export type AvatarStore = StoreApi<AvatarStoreState>

export function createAvatarStore(manifest: Manifest): AvatarStore {
  return createStore<AvatarStoreState>()((set, get) => ({
    avatar: rules.createEmptyState(manifest, manifest.bases[0].id),
    activeSlot: manifest.slots[0]?.id ?? '',
    equip(part) {
      set({ avatar: rules.equipPart(get().avatar, part, manifest) })
    },
    unequip(slotId, partId) {
      set({ avatar: rules.unequipPart(get().avatar, slotId, partId) })
    },
    toggle(part) {
      const slot = manifest.slots.find((s) => s.id === part.slot)
      const current = get().avatar.equipped[part.slot] ?? []
      if (current.includes(part.id)) {
        if (slot?.multiple) get().unequip(part.slot, part.id)
        return
      }
      get().equip(part)
    },
    applyPreset(preset) {
      set({ avatar: rules.applyPreset(get().avatar, preset, manifest) })
    },
    setBase(base) {
      const r = rules.changeBase(get().avatar, base, manifest)
      set({ avatar: r.state })
      return r.removed
    },
    reset() {
      set({ avatar: rules.createEmptyState(manifest, manifest.bases[0].id) })
    },
    replace(next) {
      set({ avatar: next })
    },
    setActiveSlot(id) {
      set({ activeSlot: id })
    },
  }))
}

// ---- selector：接收 store 状态的纯函数，组件里配合 useStore 使用 ----

export function selectBase(manifest: Manifest, s: AvatarStoreState): BaseModel {
  return manifest.bases.find((b) => b.id === s.avatar.baseId) ?? manifest.bases[0]
}

export function selectVisibleSlots(manifest: Manifest, s: AvatarStoreState): Slot[] {
  const base = selectBase(manifest, s)
  return manifest.slots.filter((slot) => rules.partsForSlot(manifest, slot.id, base).length > 0)
}

export function selectPartsInActiveSlot(manifest: Manifest, s: AvatarStoreState): Part[] {
  return rules.partsForSlot(manifest, s.activeSlot, selectBase(manifest, s))
}

export function selectEquippedIds(s: AvatarStoreState): string[] {
  return Object.values(s.avatar.equipped).flat()
}

export function selectEquippedCount(s: AvatarStoreState): number {
  return selectEquippedIds(s).length
}

/**
 * 预设覆盖的每个槽位上装的都是该套装的部件时返回它，否则 null。
 * 按套装名比对而不是按部件 id，因为男女底模各有一套同名部件；资源脚本保证预设 id 等于套装名。
 */
export function selectCurrentPreset(manifest: Manifest, s: AvatarStoreState): Preset | null {
  for (const preset of manifest.presets) {
    const hit = Object.keys(preset.parts).every((slotId) => {
      const id = (s.avatar.equipped[slotId] ?? [])[0]
      const p = id ? manifest.parts.find((x) => x.id === id) : undefined
      return p?.set === preset.id
    })
    if (hit) return preset
  }
  return null
}
```

- [ ] **Step 14: 跑 store 测试确认通过**

Run: `npx vitest run tests/avatarStore.test.ts`
Expected: 6 passed。

- [ ] **Step 15: 改写 viewerSync 测试**

`tests/viewerSync.test.ts` 整个替换为：

```ts
import { describe, expect, it, vi } from 'vitest'
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
import { createAvatarStore } from '@/state/avatarStore'
import { createViewerSync, diffEquipped, type ViewerLike } from '@/state/viewerSync'
import { makeManifest, part } from './fixtures/manifest'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeViewer implements ViewerLike {
  calls: string[] = []
  equipped = new Set<string>()
  base = ''
  failEquip = new Set<string>()
  throwOnUnequip = false
  gates = new Map<string, Promise<void>>()
  async setBase(b: BaseModel) { this.calls.push(`base:${b.id}`); this.base = b.id; this.equipped.clear() }
  async equip(p: Part) {
    this.calls.push(`equip:${p.id}`)
    await this.gates.get(p.id)
    if (this.failEquip.has(p.id)) throw new Error('boom')
    this.equipped.add(p.id)
  }
  unequip(id: string) {
    this.calls.push(`unequip:${id}`)
    if (this.throwOnUnequip) { this.throwOnUnequip = false; throw new Error('unequip boom') }
    this.equipped.delete(id)
  }
  async playAnimation(a: AnimationRef) { this.calls.push(`anim:${a.id}`) }
}

function setup() {
  const m = makeManifest()
  const store = createAvatarStore(m)
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
  it('启动时设置底模、播放待机动画', async () => {
    const { viewer, sync } = setup()
    await sync.idle()
    expect(viewer.calls).toEqual(['base:female_regular', 'anim:idle'])
  })

  it('装一件服装后四件都装上；卸下后调用 unequip', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'ranger_body'))
    await sync.idle()
    expect([...viewer.equipped].sort()).toEqual(['ranger_arms', 'ranger_body', 'ranger_feet', 'ranger_legs'])
    store.getState().unequip('body')
    await sync.idle()
    expect(viewer.calls).toContain('unequip:ranger_body')
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })

  it('只改 activeSlot 不会触发任何 viewer 调用', async () => {
    const { store, viewer, sync } = setup()
    await sync.idle()
    const before = viewer.calls.length
    store.getState().setActiveSlot('body')
    await sync.idle()
    expect(viewer.calls.length).toBe(before)
  })

  it('装失败的部件上报错误并从状态移除', async () => {
    const { m, store, viewer, sync, onError } = setup()
    viewer.failEquip.add('hood')
    await sync.idle()
    store.getState().equip(part(m, 'hood'))
    await sync.idle()
    expect(onError).toHaveBeenCalledWith('hood', expect.any(Error))
    expect(store.getState().avatar.equipped.accessory).toEqual([])
    expect(viewer.equipped.has('hood')).toBe(false)
  })

  it('换底模后重新装回仍匹配的部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'hair_f'))
    store.getState().equip(part(m, 'ranger_body'))
    await sync.idle()
    store.getState().setBase(m.bases[1])
    await sync.idle()
    expect(viewer.base).toBe('male_regular')
    expect(viewer.equipped.has('hair_f')).toBe(false)
    expect(viewer.equipped.has('ranger_body')).toBe(true)
    expect(viewer.calls.filter((c) => c === 'anim:idle')).toHaveLength(2)
  })

  it('加载完成前卸下：最终不保留该部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    const gate = deferred()
    viewer.gates.set('ranger_body', gate.promise)
    store.getState().equip(part(m, 'ranger_body'))
    for (let i = 0; i < 10 && !viewer.calls.includes('equip:ranger_body'); i++) await tick()
    expect(viewer.calls).toContain('equip:ranger_body')
    store.getState().unequip('body')
    gate.resolve()
    await sync.idle()
    expect(viewer.equipped.has('ranger_body')).toBe(false)
    expect(viewer.calls).toContain('unequip:ranger_body')
  })

  it('unequip 抛错不会毒化队列', async () => {
    const { m, store, viewer, sync, onError } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'hood'))
    await sync.idle()
    viewer.throwOnUnequip = true
    store.getState().unequip('accessory')
    await expect(sync.idle()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith('sync', expect.any(Error))
    store.getState().equip(part(m, 'hair_f'))
    await sync.idle()
    expect(viewer.calls).toContain('equip:hair_f')
  })

  it('stop 之后状态变化不再同步', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    sync.stop()
    store.getState().equip(part(m, 'hood'))
    await tick()
    expect(viewer.calls).not.toContain('equip:hood')
  })
})
```

- [ ] **Step 16: 重写 viewerSync.ts**

整个文件替换为：

```ts
import type { AnimationRef, BaseModel, Manifest, Part } from '@/types/manifest'
import type { AvatarState } from '@/avatar/slotRules'
import type { AvatarStore } from './avatarStore'

export interface ViewerLike {
  setBase(base: BaseModel): Promise<void>
  equip(part: Part): Promise<void>
  unequip(partId: string): void
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

/**
 * 监听 store 里 avatar 的变化，把差分推给 viewer。
 * 所有动作串进一个队列；某件部件装备失败时从 store 里卸掉它，保持界面与 3D 一致。
 */
export function createViewerSync(
  store: AvatarStore,
  viewer: ViewerLike,
  manifest: Manifest,
  onError: (id: string, err: unknown) => void,
): ViewerSync {
  let queue: Promise<void> = Promise.resolve()
  const idleAnim: AnimationRef | undefined = manifest.animations[0]
  const partOf = (id: string) => manifest.parts.find((p) => p.id === id)

  async function equipAll(ids: string[]): Promise<void> {
    for (const id of ids) {
      const part = partOf(id)
      if (!part) continue
      try {
        await viewer.equip(part)
      } catch (e) {
        onError(id, e)
        store.getState().unequip(part.slot, id)
      }
    }
  }

  async function applyInner(next: AvatarState, prev: AvatarState | undefined): Promise<void> {
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
      await equipAll(Object.values(next.equipped).flat())
      return
    }
    const { added, removed } = diffEquipped(prev.equipped, next.equipped)
    for (const id of removed) viewer.unequip(id)
    await equipAll(added)
  }

  function enqueue(next: AvatarState, prev: AvatarState | undefined): void {
    queue = queue
      .then(() => applyInner(next, prev))
      .catch((e: unknown) => onError('sync', e))
  }

  enqueue(store.getState().avatar, undefined)
  const unsubscribe = store.subscribe((s, prevState) => {
    if (s.avatar === prevState.avatar) return
    enqueue(s.avatar, prevState.avatar)
  })

  async function idle(): Promise<void> {
    let last: Promise<void>
    do {
      await new Promise<void>((r) => setTimeout(r, 0))
      last = queue
      await last
    } while (last !== queue)
  }

  return { stop: unsubscribe, idle }
}
```

- [ ] **Step 17: 删除旧状态层**

```bash
git rm -q src/state/useAvatarState.ts tests/useAvatarState.test.ts
```

- [ ] **Step 18: 跑全部测试与类型检查**

Run: `npm test && npm run typecheck`
Expected: 全部通过。`realManifest.test.ts` 因 `public/avatar/manifest.json` 不存在而 skip 是正常的。

- [ ] **Step 19: 提交**

```bash
git add -A src tests package.json package-lock.json
git commit -m "refactor: 规则与数据层去变体，状态层改用 zustand

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 切换到 Next.js 骨架

**Files:**
- Delete: `index.html`、`vite.config.ts`、`src/main.ts`、`src/App.vue`、`src/env.d.ts`、`src/styles/base.css`、`src/styles/theme.css`
- Rewrite: `package.json`（scripts 与依赖）、`tsconfig.json`、`.gitignore`
- Create: `next.config.ts`、`vitest.config.ts`、`.env.example`、`app/layout.tsx`、`app/globals.css`、`app/page.tsx`、`app/create/page.tsx`
- Modify: `src/data/assetUrl.ts`
- Create: `tests/assetUrl.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `assetUrl(path: string, base?: string): string`，默认 `base` 读 `process.env.NEXT_PUBLIC_ASSET_BASE || '/avatar/'`。
  - `app/globals.css` 的令牌名（见 Global Constraints）与四个工具类：`.btn-primary`、`.btn-ghost`、`.font-display`、`.font-mark`。
  - 路由 `/` 与 `/create` 各有一个占位页，后续任务替换其内容。

- [ ] **Step 1: 换依赖**

```bash
npm uninstall vue @vitejs/plugin-vue vue-tsc vite
npm install next@16.4.0 react@19.3.0 react-dom@19.3.0 sharp@^0.35
npm install -D @types/react@19 @types/react-dom@19 subset-font@^2
```

Expected: `package.json` 里没有 vue、vite；有 next 16.4.0、react 19.3.0。

- [ ] **Step 2: 删除 Vite 与 Vue 文件**

```bash
git rm -q index.html vite.config.ts src/main.ts src/App.vue src/env.d.ts src/styles/base.css src/styles/theme.css
```

- [ ] **Step 3: 改 package.json 的 scripts**

把 `"scripts"` 整块替换为：

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "assets:scan": "node scripts/build-manifest.mjs --scan",
    "assets:build": "node scripts/build-manifest.mjs",
    "fonts:build": "node scripts/build-fonts.mjs"
  },
```

保留 `"type": "module"`。

- [ ] **Step 4: 重写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] },
    "types": ["node"]
  },
  "include": [
    "next-env.d.ts",
    "app/**/*.ts", "app/**/*.tsx",
    "components/**/*.ts", "components/**/*.tsx",
    "src/**/*.ts",
    "tests/**/*.ts",
    "next.config.ts", "vitest.config.ts",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: 新建 next.config.ts 与 vitest.config.ts**

`next.config.ts`：

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
}

export default nextConfig
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,mjs}'],
  },
})
```

- [ ] **Step 6: 重写 .gitignore 与新建 .env.example**

`.gitignore`：

```
node_modules
.next
out
*.tsbuildinfo
next-env.d.ts
assets-src/
.env*.local
*.local
.DS_Store
```

注意 `public/avatar/` 不再忽略，资源会进 git。

`.env.example`：

```
# 服务端运行时变量，云托管「服务设置 → 环境变量」里配
POSTER_PROVIDER=mock
# 构建期变量，改了要重新 build；默认同源 /avatar/
NEXT_PUBLIC_ASSET_BASE=/avatar/
# 首页顶栏的 GitHub 链接，留空则不显示该按钮
NEXT_PUBLIC_REPO_URL=
```

- [ ] **Step 7: 新建 app/globals.css**

```css
/* 设计系统令牌：单主题暗色，来自画板「设计系统」 */
:root {
  color-scheme: dark;
  --ground: #0F0E14;
  --panel: #13121A;
  --card: #1B1A23;
  --card-raised: #1F1E28;
  --line: #2A2834;
  --line-hover: #3A3846;
  --line-soft: #23222C;
  --text: #EFEDF3;
  --muted: #A09DAE;
  --accent: #E8A445;
  --accent-hover: #F2B85C;
  --on-accent: #1A1206;
  --ai: #AE98F2;
  --ok: #6FCF97;
  --warn: #F2C94C;
  --error: #EB7A7A;
  --font-body: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", system-ui, sans-serif;
  --radius-card: 14px;
  --radius-pill: 999px;
  --topbar-h: 64px;
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }
button { font-family: inherit; }
:focus-visible { outline: 2px solid var(--ai); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}

/* 字体角色：变量由 app/layout.tsx 的 next/font 注入，没注入时退回正文字体 */
.font-display { font-family: var(--font-huangyou, var(--font-body)); font-weight: 400; letter-spacing: 0.06em; }
.font-mark { font-family: var(--font-orbitron, var(--font-body)); font-weight: 700; letter-spacing: 0.18em; }

/* 两种胶囊按钮 */
.btn-primary, .btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 20px; border-radius: var(--radius-pill);
  font-size: 14px; cursor: pointer; white-space: nowrap;
}
.btn-primary { border: 0; background: var(--accent); color: var(--on-accent); font-weight: 700; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { border: 1px solid var(--line); background: #17161E; color: var(--text); }
.btn-ghost:hover { border-color: var(--line-hover); background: var(--card-raised); }
```

- [ ] **Step 8: 新建 layout 与两个占位页**

`app/layout.tsx`：

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Avatar Dressup',
  description: '在浏览器里实时换装，再让 AI 画成海报',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx`：

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1 className="font-display">Avatar Dressup</h1>
      <p>首页建设中。</p>
      <Link href="/create" className="btn-primary">开始创建</Link>
    </main>
  )
}
```

`app/create/page.tsx`：

```tsx
export default function CreatePage() {
  return <main style={{ padding: 32 }}>换装页建设中。</main>
}
```

- [ ] **Step 9: 写 assetUrl 的失败测试**

新建 `tests/assetUrl.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { assetUrl } from '@/data/assetUrl'

describe('assetUrl', () => {
  it('默认前缀是同源 /avatar/', () => {
    expect(assetUrl('manifest.json')).toBe('/avatar/manifest.json')
  })

  it('基址带不带尾斜杠、路径带不带前导斜杠，拼出来都只有一个斜杠', () => {
    expect(assetUrl('/models/a.glb', 'https://cdn.example.com/avatar')).toBe('https://cdn.example.com/avatar/models/a.glb')
    expect(assetUrl('models/a.glb', 'https://cdn.example.com/avatar/')).toBe('https://cdn.example.com/avatar/models/a.glb')
    expect(assetUrl('//models/a.glb', '/avatar/')).toBe('/avatar/models/a.glb')
  })
})
```

Run: `npx vitest run tests/assetUrl.test.ts`
Expected: FAIL，现在的实现用 `import.meta.env.BASE_URL`，在 Node 下是 undefined。

- [ ] **Step 10: 重写 assetUrl.ts**

```ts
/** 构建期常量：Next 会把 NEXT_PUBLIC_* 内联进客户端包 */
const DEFAULT_BASE = process.env.NEXT_PUBLIC_ASSET_BASE || '/avatar/'

/** 把 manifest 里的相对路径拼成可请求的 URL */
export function assetUrl(path: string, base: string = DEFAULT_BASE): string {
  const prefix = base.endsWith('/') ? base : `${base}/`
  return prefix + path.replace(/^\/+/, '')
}
```

Run: `npx vitest run tests/assetUrl.test.ts`
Expected: 2 passed。

- [ ] **Step 11: 跑测试、类型检查、构建**

Run: `npm test && npm run typecheck && npm run build`
Expected: 测试全过；`next build` 成功，输出里有 `/` 与 `/create` 两个静态路由，`.next/standalone/server.js` 存在。

- [ ] **Step 12: 开发服务器冒烟**

Run: `npm run dev`，浏览器打开 `http://localhost:3000`，看到「首页建设中」与「开始创建」按钮，点进 `/create` 看到「换装页建设中」。按钮是余烬金胶囊，页面底色是近黑紫。关掉服务器。

- [ ] **Step 13: 提交**

```bash
git add -A
git commit -m "build: 切换到 Next.js 16 骨架，删除 Vite 与 Vue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

根目录那三个 zip 和一个 pdf 是用户自己的文件，不要提交。若 `git add -A` 把它们带进来了，用 `git reset HEAD -- "*.zip" "*.pdf"` 退掉再提交。

---

### Task 4: 字体子集化脚本与接入

**Files:**
- Create: `scripts/build-fonts.mjs`
- Create（脚本生成，进 git）: `app/fonts/orbitron-subset.woff2`、`app/fonts/huangyou-subset.woff2`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Task 3 的 `.font-display`、`.font-mark` 两个类（它们读 `--font-huangyou`、`--font-orbitron`）。
- Produces: `<html>` 上挂着 next/font 注入的两个 CSS 变量；`npm run fonts:build` 可重复运行，文案变化后重跑即可。

- [ ] **Step 1: 新建 scripts/build-fonts.mjs**

```js
#!/usr/bin/env node
// 下载两款 OFL 许可的字体 TTF，按项目源码里实际出现的字符子集化为 woff2，写到 app/fonts/。
// 用法: node scripts/build-fonts.mjs    文案或 manifest 里的中文变了就重跑一次。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import subsetFont from 'subset-font'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'app', 'fonts')
const GITHUB_FONTS = 'https://raw.githubusercontent.com/google/fonts/main/ofl'

function ascii() {
  let s = ''
  for (let c = 0x20; c < 0x7f; c++) s += String.fromCharCode(c)
  return s
}

/** 扫描页面源码与 manifest 里出现过的中日韩字符与全角标点 */
async function cjkInSource() {
  const files = await fg(
    ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'public/avatar/manifest.json'],
    { cwd: ROOT, onlyFiles: true },
  )
  const chars = new Set('·，。：、！？（）「」…')
  for (const f of files) {
    const text = await readFile(path.join(ROOT, f), 'utf8')
    for (const ch of text) if (/[　-〿一-鿿＀-￯]/.test(ch)) chars.add(ch)
  }
  return [...chars].join('')
}

async function fetchBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 ${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

const cjk = await cjkInSource()
const FONTS = [
  {
    name: 'Orbitron',
    url: `${GITHUB_FONTS}/orbitron/Orbitron%5Bwght%5D.ttf`,
    out: 'orbitron-subset.woff2',
    text: ascii(),
    variationAxes: { wght: { min: 600, max: 700, default: 700 } },
  },
  {
    name: 'ZCOOL QingKe HuangYou',
    url: `${GITHUB_FONTS}/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf`,
    out: 'huangyou-subset.woff2',
    text: ascii() + cjk,
    variationAxes: undefined,
  },
]

await mkdir(OUT, { recursive: true })
for (const f of FONTS) {
  const ttf = await fetchBuffer(f.url)
  const woff2 = await subsetFont(ttf, f.text, { targetFormat: 'woff2', variationAxes: f.variationAxes })
  await writeFile(path.join(OUT, f.out), woff2)
  console.log(`${f.name}: ${f.text.length} 个字符 -> app/fonts/${f.out} ${(woff2.length / 1024).toFixed(0)} KB`)
}
```

- [ ] **Step 2: 运行脚本生成字体**

Run: `npm run fonts:build`
Expected: 两行输出，Orbitron 约 10 到 20 KB，黄油体此时只有少量中文，几十 KB。`app/fonts/` 下出现两个 woff2。

- [ ] **Step 3: layout 接入 next/font/local**

`app/layout.tsx` 整个替换为：

```tsx
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'

const orbitron = localFont({
  src: './fonts/orbitron-subset.woff2',
  weight: '600 700',
  variable: '--font-orbitron',
  display: 'swap',
})

const huangyou = localFont({
  src: './fonts/huangyou-subset.woff2',
  weight: '400',
  variable: '--font-huangyou',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Avatar Dressup',
  description: '在浏览器里实时换装，再让 AI 画成海报',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={`${orbitron.variable} ${huangyou.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: 验证字体生效**

Run: `npm run dev`，打开 `http://localhost:3000`。在开发者工具里选中 h1，Computed 面板的 font-family 第一项应是 next/font 生成的黄油体家族名（形如 `__huangyou_xxxxxx`），字形是几何黑体而不是系统黑体。Network 面板里 woff2 请求 200。

- [ ] **Step 5: 跑测试、类型检查、构建后提交**

Run: `npm test && npm run typecheck && npm run build`

```bash
git add scripts/build-fonts.mjs app/fonts app/layout.tsx
git commit -m "feat: 自托管 Orbitron 与站酷庆科黄油体，按源码字符子集化

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 资源脚本改造与资源生成

**Files:**
- Modify: `scripts/manifest.config.mjs`、`scripts/lib/classify.mjs`、`scripts/build-manifest.mjs`
- Modify: `tests/classify.test.mjs`
- Modify: `docs/ASSETS.md`
- Create（脚本生成，进 git）: `public/avatar/manifest.json`、`public/avatar/models/**`、`public/avatar/anim/**`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `classifyFiles(files, rules, { setLabels, slotLabels, pieceLabels, nameLabels })` 返回 `{ bases, parts, animations, unmatched }`；`bases[]` 没有 `bodyMeshes`、`headMeshes`；`parts[].variants` 恒为 `[]`；`parts[].id` 等于文件名 slug，带性别前缀，例如 `female_ranger_body`。
  - 新增纯函数 `detectPiece(rel): string`。
  - `buildPresets` 不变，保证预设 `id` 等于套装名。
  - 生成的 manifest：底模 2，发型 6，眉毛 2，上身、手臂、腿部、鞋靴各 4，配饰 4，预设 2，动画 1。

- [ ] **Step 1: 改写 classify 测试为真实目录结构**

`tests/classify.test.mjs` 整个替换为：

```js
import { describe, expect, it } from 'vitest'
import {
  buildPresets, chooseAnimation, classifyFiles, detectPiece, detectSet, detectSex, slugify,
} from '../scripts/lib/classify.mjs'
import { nameLabels, pieceLabels, rules, setLabels, slotLabels, slots } from '../scripts/manifest.config.mjs'

const BASE = 'base/Universal Base Characters[Standard]'
const OUT = 'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)'
const files = [
  `${BASE}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`,
  `${BASE}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Long.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_BuzzedFemale.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Eyebrows_Female.gltf`,
  `${BASE}/Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Body.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Arms.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Legs.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Feet.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Head_Hood.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Acc_Pauldrons.gltf`,
  `${OUT}/Modular Parts/Male_Ranger_Feet_Boots.gltf`,
  `${OUT}/Modular Parts/Female_Peasant_Body.gltf`,
  `${OUT}/Outfits/Female_Ranger.gltf`,
  'anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  'anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb',
  'misc/Thing.gltf',
]
const opts = { setLabels, slotLabels, pieceLabels, nameLabels }

describe('helpers', () => {
  it('slugify', () => expect(slugify('Ranger Body-01.glb')).toBe('ranger_body_01_glb'))
  it('detectSex 区分 Female、Male 与无性别', () => {
    expect(detectSex(files[0])).toBe('female')
    expect(detectSex(files[1])).toBe('male')
    expect(detectSex(files[3])).toBe('female')
    expect(detectSex(files[2])).toBe('any')
  })
  it('detectSet 去掉性别前缀后取文件名第一段', () => {
    expect(detectSet(`${OUT}/Modular Parts/Female_Ranger_Body.gltf`)).toBe('ranger')
    expect(detectSet('outfits/x/Ranger_Hood.gltf')).toBe('ranger')
  })
  it('detectPiece 取套装名之后的部分', () => {
    expect(detectPiece(`${OUT}/Modular Parts/Female_Ranger_Acc_Pauldrons.gltf`)).toBe('acc_pauldrons')
    expect(detectPiece(`${OUT}/Modular Parts/Male_Ranger_Feet_Boots.gltf`)).toBe('feet_boots')
    expect(detectPiece('outfits/x/Ranger_Hood.gltf')).toBe('hood')
  })
})

describe('classifyFiles', () => {
  const r = classifyFiles(files, rules, opts)

  it('底模带中文名，没有 bodyMeshes', () => {
    expect(r.bases.map((b) => [b.id, b.sex, b.label])).toEqual([
      ['superhero_female_fullbody', 'female', '女性'],
      ['superhero_male_fullbody', 'male', '男性'],
    ])
    expect(r.bases[0].url).toBe('models/base/superhero_female_fullbody.glb')
    expect(r.bases[0]).not.toHaveProperty('bodyMeshes')
  })

  it('只收 Rigged to Head Bone 的发型与眉毛，Origin at 0 不收', () => {
    const hair = r.parts.filter((p) => p.slot === 'hair')
    expect(hair.map((p) => [p.id, p.label, p.sex])).toEqual([
      ['hair_long', '长发', 'any'],
      ['hair_buzzedfemale', '寸头', 'female'],
    ])
    expect(r.parts.find((p) => p.id === 'eyebrows_female').slot).toBe('eyebrows')
    expect(r.unmatched).toContain(`${BASE}/Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.gltf`)
  })

  it('服装按文件名归槽位，id 带性别，label 是套装加部位', () => {
    const female = r.parts.filter((p) => p.id.startsWith('female_ranger'))
    const bySlot = Object.fromEntries(female.filter((p) => p.slot !== 'accessory').map((p) => [p.slot, p]))
    expect(bySlot.body.label).toBe('游侠 上衣')
    expect(bySlot.body.url).toBe('models/outfits/ranger/female_ranger_body.glb')
    expect(bySlot.body.sex).toBe('female')
    expect(bySlot.arms.label).toBe('游侠 护臂')
    expect(bySlot.legs.label).toBe('游侠 长裤')
    expect(bySlot.feet.label).toBe('游侠 鞋')
    const byId = Object.fromEntries(r.parts.map((p) => [p.id, p]))
    expect(byId.female_ranger_head_hood.label).toBe('游侠 兜帽')
    expect(byId.female_ranger_head_hood.slot).toBe('accessory')
    expect(byId.female_ranger_acc_pauldrons.label).toBe('游侠 肩甲')
    expect(byId.male_ranger_feet_boots.label).toBe('游侠 长靴')
    expect(byId.male_ranger_feet_boots.slot).toBe('feet')
  })

  it('Outfits 整套文件不收', () => {
    expect(r.parts.some((p) => p.id === 'female_ranger')).toBe(false)
    expect(r.unmatched).toContain(`${OUT}/Outfits/Female_Ranger.gltf`)
  })

  it('动画只收非 _RM 的那个，其他目录不收', () => {
    expect(r.animations.map((a) => a.id)).toEqual(['ual1_standard'])
    expect(r.unmatched).toContain('anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb')
    expect(r.unmatched).toContain('misc/Thing.gltf')
  })

  it('所有部件的 variants 为空数组', () => {
    expect(r.parts.every((p) => Array.isArray(p.variants) && p.variants.length === 0)).toBe(true)
  })
})

describe('buildPresets', () => {
  it('四个服装槽位齐全的套装才生成预设，id 等于套装名', () => {
    const r = classifyFiles(files, rules, opts)
    const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
    expect(buildPresets(r.parts, outfitSlotIds, setLabels)).toEqual([
      {
        id: 'ranger',
        label: '游侠',
        parts: { body: 'female_ranger_body', arms: 'female_ranger_arms', legs: 'female_ranger_legs', feet: 'female_ranger_feet' },
      },
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

- [ ] **Step 2: 跑确认失败**

Run: `npx vitest run tests/classify.test.mjs`
Expected: FAIL，`detectPiece`、`pieceLabels`、`nameLabels` 不存在。

- [ ] **Step 3: 重写 manifest.config.mjs**

```js
// 解压素材后先运行 `npm run assets:scan`，对照输出调整这里的 rules 与各 labels。
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

/** 套装名（文件名去掉性别前缀后的第一段，小写）到中文名 */
export const setLabels = {
  ranger: '游侠', peasant: '农夫', knight: '骑士', noble: '贵族', wizard: '法师',
  mage: '法师', rogue: '盗贼', priest: '牧师', barbarian: '野蛮人', archer: '弓手',
  merchant: '商人', king: '国王', queen: '女王', druid: '德鲁伊',
}

/** 服装文件名在套装名之后的那段（小写、下划线）到中文名；没列的退回槽位名 */
export const pieceLabels = {
  body: '上衣', arms: '护臂', legs: '长裤', feet: '鞋', feet_boots: '长靴',
  acc_pauldron: '肩甲', acc_pauldrons: '肩甲', head_hood: '兜帽',
}

/** 按整个文件名 slug 精确匹配的中文名：底模、发型、眉毛 */
export const nameLabels = {
  superhero_female_fullbody: '女性', superhero_male_fullbody: '男性',
  hair_long: '长发', hair_buns: '丸子头', hair_buzzed: '寸头', hair_buzzedfemale: '寸头',
  hair_simpleparted: '分头', hair_beard: '胡须',
  eyebrows_regular: '常规眉', eyebrows_female: '女性眉',
}

/**
 * 按顺序匹配，第一条命中生效。
 * 只扫三个来源目录里真正要用的子目录：底模的 Base Characters、发型眉毛的 Rigged to Head Bone、
 * 服装的 Modular Parts、动画里不带 _RM（根运动）的文件。其余一律落到 unmatched。
 */
export const rules = [
  { test: /^base\/.*Rigged to Head Bone\/.*\/eyebrows?\w*\.(glb|gltf)$/i, kind: 'part', slot: 'eyebrows' },
  { test: /^base\/.*Rigged to Head Bone\/.*\/hair\w*\.(glb|gltf)$/i, kind: 'part', slot: 'hair' },
  { test: /^base\/.*Base Characters\/.*\.(glb|gltf)$/i, kind: 'base' },
  { test: /^outfits\/.*Modular Parts\/.*_(body|torso|chest|shirt|robe)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'body' },
  { test: /^outfits\/.*Modular Parts\/.*_(arms?|sleeves?|gloves?|bracers?)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'arms' },
  { test: /^outfits\/.*Modular Parts\/.*_(legs?|pants|trousers|skirt)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'legs' },
  { test: /^outfits\/.*Modular Parts\/.*_(feet|foot|boots?|shoes?)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'feet' },
  { test: /^outfits\/.*Modular Parts\/.*\.(glb|gltf)$/i, kind: 'part', slot: 'accessory' },
  { test: /^anim\/(?!.*_RM\.).*\.(glb|gltf)$/i, kind: 'animation' },
]
```

- [ ] **Step 4: 重写 lib/classify.mjs**

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

/** 去掉 Female_ / Male_ 前缀后的文件名分段 */
function tokens(rel) {
  const name = baseName(rel).replace(/^(female|male)[_\-\s]+/i, '')
  return name.split(/[_\-\s]+/).filter(Boolean)
}

/** 套装名：去掉性别前缀后的第一段，例如 Female_Ranger_Body -> ranger */
export function detectSet(rel) {
  const [first] = tokens(rel)
  return first ? slugify(first) : null
}

/** 部位段：套装名之后的部分，例如 Male_Ranger_Feet_Boots -> feet_boots */
export function detectPiece(rel) {
  return slugify(tokens(rel).slice(1).join('_'))
}

/** @param {string} rel */
export function labelFromFile(rel) {
  return baseName(rel).replace(/[_\-]+/g, ' ').trim()
}

/**
 * @param {string[]} files 相对 assets-src 的路径，正斜杠
 * @param {Rule[]} rules 按顺序匹配，第一条命中生效
 * @param {{ setLabels?: Record<string,string>, slotLabels?: Record<string,string>,
 *           pieceLabels?: Record<string,string>, nameLabels?: Record<string,string> }} [opts]
 */
export function classifyFiles(files, rules, opts = {}) {
  const setLabels = opts.setLabels ?? {}
  const slotLabels = opts.slotLabels ?? {}
  const pieceLabels = opts.pieceLabels ?? {}
  const nameLabels = opts.nameLabels ?? {}
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
        id: slug, sex: detectSex(rel), label: nameLabels[slug] ?? labelFromFile(rel), src: rel,
        url: `models/base/${slug}.glb`,
      })
    } else if (rule.kind === 'animation') {
      out.animations.push({ id: slug, label: labelFromFile(rel), src: rel, url: `anim/${slug}.glb`, clip: '' })
    } else {
      const slot = rule.slot ?? 'accessory'
      const headSlot = slot === 'hair' || slot === 'eyebrows'
      const set = headSlot ? null : detectSet(rel)
      const piece = headSlot ? '' : detectPiece(rel)
      const dir = set ? `models/outfits/${set}` : `models/${slot}`
      const label = headSlot
        ? (nameLabels[slug] ?? labelFromFile(rel))
        : `${setLabels[set] ?? set} ${pieceLabels[piece] ?? slotLabels[slot] ?? slot}`
      out.parts.push({ id: slug, slot, set, label, sex: detectSex(rel), src: rel, url: `${dir}/${slug}.glb`, variants: [] })
    }
  }
  return out
}

/**
 * 只有四个服装槽位齐全的套装才生成预设；预设 id 等于套装名，每个槽位记第一个遇到的部件 id。
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

- [ ] **Step 5: 跑 classify 测试确认通过**

Run: `npx vitest run tests/classify.test.mjs`
Expected: 11 passed。

- [ ] **Step 6: 重写 build-manifest.mjs**

```js
#!/usr/bin/env node
// 扫描 assets-src/，归类、优化、复制为单文件 glb，生成 public/avatar/manifest.json。
// 用法: node scripts/build-manifest.mjs [--scan]   --scan 只列出识别结果，不写文件。
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample, textureCompress } from '@gltf-transform/functions'
import { buildPresets, chooseAnimation, classifyFiles } from './lib/classify.mjs'
import { nameLabels, pieceLabels, rules, setLabels, skeleton, slotLabels, slots } from './manifest.config.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'assets-src')
const OUT = path.join(ROOT, 'public', 'avatar')
const SCAN = process.argv.includes('--scan')
/** 贴图最长边，原素材是 4096，缩到 1024 并转 webp 后单张约 200 到 400 KB */
const TEXTURE_MAX = 1024

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

/** 去重、裁剪、重采样，贴图缩到 TEXTURE_MAX 并转 webp，写成单文件 glb */
async function writeGlb(doc, relUrl) {
  await doc.transform(
    dedup(),
    prune(),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_MAX, TEXTURE_MAX], quality: 85 }),
  )
  const dest = path.join(OUT, relUrl)
  await mkdir(path.dirname(dest), { recursive: true })
  await io.write(dest, doc)
}

async function main() {
  const models = (await fg(['**/*.{glb,gltf}'], { cwd: SRC, onlyFiles: true })).sort()
  if (!models.length) {
    console.error('assets-src 下没有 glb/gltf 文件。请先按 docs/ASSETS.md 下载并解压素材。')
    process.exit(1)
  }
  const cls = classifyFiles(models, rules, { setLabels, slotLabels, pieceLabels, nameLabels })
  const kindOf = (rel) =>
    cls.bases.some((b) => b.src === rel) ? '底模'
    : cls.animations.some((a) => a.src === rel) ? '动画'
    : (cls.parts.find((p) => p.src === rel)?.slot ?? '未匹配')

  if (SCAN) {
    for (const rel of models) {
      const kind = kindOf(rel)
      if (kind === '未匹配') {
        console.log(`${rel}\n  归类: 未匹配`)
        continue
      }
      const { meshNames, joints, clips } = await inspect(path.join(SRC, rel))
      console.log(`${rel}\n  归类: ${kind}  骨骼: ${joints}  网格: ${meshNames.join(', ') || '(无)'}${clips.length ? `\n  动画: ${clips.length} 个剪辑，含 ${clips.filter((c) => /idle/i.test(c)).join(', ') || '无 idle'}` : ''}`)
    }
    return
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const warnings = []

  for (const b of cls.bases) {
    const { doc, joints } = await inspect(path.join(SRC, b.src))
    if (joints !== skeleton.expectedBones) warnings.push(`${b.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    await writeGlb(doc, b.url)
    delete b.src
  }

  for (const p of cls.parts) {
    const { doc, joints } = await inspect(path.join(SRC, p.src))
    if (joints && joints !== skeleton.expectedBones) warnings.push(`${p.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    await writeGlb(doc, p.url)
    delete p.src
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
    const root = c.doc.getRoot()
    // 只保留选中的剪辑；动画文件自带的网格和材质也用不到，一并丢掉，prune 会清掉它们的数据
    for (const anim of root.listAnimations()) if (anim.getName() !== chosen.clip) anim.dispose()
    for (const mesh of root.listMeshes()) mesh.dispose()
    for (const mat of root.listMaterials()) mat.dispose()
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
  if (cls.unmatched.length) console.log(`未匹配 ${cls.unmatched.length} 个文件（整套 Outfits、Origin at 0 发型、_RM 动画属正常）`)
  for (const w of warnings) console.warn(`警告: ${w}`)
  console.log(`已写入 ${path.relative(ROOT, path.join(OUT, 'manifest.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 7: 解压素材**

三个 zip 在仓库根目录。PowerShell 里执行（Git Bash 没有 unzip 时用这个）：

```powershell
Expand-Archive -Path "Universal Base Characters[Standard].zip" -DestinationPath assets-src/base -Force
Expand-Archive -Path "Modular Character Outfits - Fantasy[Standard].zip" -DestinationPath assets-src/outfits -Force
Expand-Archive -Path "Universal Animation Library[Standard].zip" -DestinationPath assets-src/anim -Force
```

Expected: `assets-src/base/Universal Base Characters[Standard]/...`、`assets-src/outfits/Modular Character Outfits - Fantasy[Standard]/...`、`assets-src/anim/Universal Animation Library[Standard]/...` 三棵目录树存在。

- [ ] **Step 8: 扫描核对归类**

Run: `npm run assets:scan`
Expected：底模 2 条（骨骼 65）、hair 6 条、eyebrows 2 条、body 4、arms 4、legs 4、feet 4、accessory 4、动画 1 条且含 idle 剪辑；其余文件显示「未匹配」。若某条归类不对，改 `manifest.config.mjs` 的 rules 后重跑，不要改代码逻辑。

- [ ] **Step 9: 生成资源**

Run: `npm run assets:build`
Expected 输出：

```
发型(hair): 6
眉毛(eyebrows): 2
上身(body): 4
手臂(arms): 4
腿部(legs): 4
鞋靴(feet): 4
配饰(accessory): 4
底模 2，预设 2，动画 1
```

然后 `du -sh public/avatar` 在 20 到 45 MB 之间；`ls -la public/avatar/anim` 里动画 glb 小于 1 MB。超过 60 MB 时把 `TEXTURE_MAX` 改为 512 重跑。

- [ ] **Step 10: 跑全部测试并重建字体**

Run: `npm test`
Expected: `realManifest.test.ts` 不再 skip 且通过。

Run: `npm run fonts:build`
Expected: 黄油体字符数比上次多（加入了 manifest 里的部件名）。

- [ ] **Step 11: 更新 docs/ASSETS.md**

整个文件替换为：

```markdown
# 素材下载与放置说明

本项目的模型来自 Quaternius 的免费素材包，所有部件共用同一副 65 关节骨骼，所以可以互相组合。脚本生成的 `public/avatar/` 已经提交在仓库里，只有需要重新生成或加新素材时才用本说明。

## 1. 下载

| 包 | 下载地址 | 下载哪个文件 | 免费层包含 |
|---|---|---|---|
| Universal Base Characters（底模与发型） | https://quaternius.itch.io/universal-base-characters | Standard zip，约 122 MB | 2 个底模、8 个发型眉毛 |
| Modular Character Outfits - Fantasy（服装部件） | https://quaternius.itch.io/modular-character-outfits-fantasy | Standard zip，约 280 MB | Ranger、Peasant 两套，男女各一 |
| Universal Animation Library（动画，取 Idle） | https://quaternius.itch.io/universal-animation-library | Standard zip，约 13 MB | 45 个动画 |

页面点「Download Now」，付费框里选「No thanks, just take me to the downloads」。许可以 zip 内 LICENSE 文件为准，itch 页面标注 CC0。

## 2. 解压到这些目录

```
avatar-dressup/
  assets-src/
    base/      <- Universal Base Characters 的 zip 解压到这里
    outfits/   <- Modular Character Outfits - Fantasy 的 zip 解压到这里
    anim/      <- Universal Animation Library 的 zip 解压到这里
```

`assets-src/` 不进 git。脚本只读这些子目录：底模的 `Base Characters`、发型眉毛的 `Rigged to Head Bone`、服装的 `Modular Parts`、动画里不带 `_RM` 的文件。`Origin at 0` 的静态发型、`Outfits` 整套文件、FBX 目录都会被忽略。

## 3. 生成

先看脚本识别到了什么：

```bash
npm run assets:scan
```

再生成，脚本会去重、裁剪、把贴图缩到 1024 并转 webp，输出单文件 glb：

```bash
npm run assets:build
```

输出 `public/avatar/manifest.json`、`public/avatar/models/`、`public/avatar/anim/`，全部进 git。生成后再跑一次 `npm run fonts:build`，让标题字体包含新的部件名。

## 4. 加新素材

把新文件放进对应目录，若 `assets:scan` 归类不对，改 `scripts/manifest.config.mjs` 里的 `rules`、`setLabels`、`pieceLabels`、`nameLabels`，不要改脚本逻辑。
```

- [ ] **Step 12: 类型检查后提交**

Run: `npm run typecheck`

```bash
git add scripts tests/classify.test.mjs docs/ASSETS.md public/avatar app/fonts
git commit -m "feat: 资源脚本按真实目录归类，贴图缩放转 webp，资源进仓库

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 换装页骨架：上下文、视口、底模渲染

**Files:**
- Create: `components/DressUpContext.tsx`、`components/DressUp.tsx`、`components/Viewport.tsx`、`components/TopBar.tsx`、`components/dressup.module.css`
- Modify: `app/create/page.tsx`

**Interfaces:**
- Consumes: Task 1 `AvatarViewer`、`ThumbnailRenderer`；Task 2 `createAvatarStore`、`createViewerSync`、`selectBase`；Task 3 `assetUrl`、`loadManifest`。
- Produces:
  - `useDressUp(): { manifest; store; viewer; thumbs; loadingIds: ReadonlySet<string>; errors: ReadonlyMap<string, string> }`
  - `<TopBar onPoster?: () => void />`：`onPoster` 不传时按钮禁用。
  - `<Viewport containerRef />`：底模下拉、全身或头部分段、动画名、截图按钮。
  - `dressup.module.css` 里的类名，Task 7 的面板直接用。

- [ ] **Step 1: 新建 DressUpContext.tsx**

```tsx
'use client'
import { createContext, useContext } from 'react'
import type { Manifest } from '@/types/manifest'
import type { AvatarStore } from '@/state/avatarStore'
import type { AvatarViewer } from '@/avatar/AvatarViewer'
import type { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'

export interface DressUpServices {
  manifest: Manifest
  store: AvatarStore
  /** 视口挂好之前为 null */
  viewer: AvatarViewer | null
  thumbs: ThumbnailRenderer | null
  /** 正在加载的部件或底模 id */
  loadingIds: ReadonlySet<string>
  /** 加载或绑定失败的部件或底模 id 到原因 */
  errors: ReadonlyMap<string, string>
}

export const DressUpContext = createContext<DressUpServices | null>(null)

export function useDressUp(): DressUpServices {
  const v = useContext(DressUpContext)
  if (!v) throw new Error('useDressUp 必须在 DressUp 内部使用')
  return v
}
```

- [ ] **Step 2: 新建 dressup.module.css**

```css
.layout { display: flex; flex-direction: column; min-height: 100vh; background: var(--ground); }

/* 顶栏 */
.topbar {
  min-height: var(--topbar-h); display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; padding: 0 24px; border-bottom: 1px solid var(--line-soft);
}
.brand { display: flex; align-items: baseline; gap: 12px; color: var(--text); }
.brandMark { font-size: 17px; }
.brandSub { font-size: 12px; letter-spacing: 0.22em; color: var(--muted); }
.topbarNav { display: flex; align-items: center; gap: 12px; }

/* 主体：左视口自适应，右面板 480，窄屏时面板堆到下面 */
.main { display: flex; flex-wrap: wrap; flex: 1; min-height: 0; }
.viewport {
  flex: 999 1 560px; min-width: 0; min-height: 640px; position: relative; overflow: hidden;
  background: radial-gradient(ellipse 70% 55% at 50% 42%, #221C2E 0%, #141219 55%, var(--ground) 100%);
}
.canvasHost { position: absolute; inset: 0; }
.canvasHost canvas { display: block; width: 100%; height: 100%; }
.hint {
  position: absolute; top: 20px; left: 24px; display: flex; align-items: center; gap: 10px;
  font-size: 12px; color: var(--muted); letter-spacing: 0.08em; pointer-events: none;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); }
.dotBusy { background: var(--warn); }
.chips { position: absolute; left: 24px; bottom: 24px; display: flex; gap: 10px; flex-wrap: wrap; }
.chip, .segment {
  display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: var(--radius-pill);
  border: 1px solid var(--line); background: rgba(23, 22, 30, 0.85); color: var(--text); font-size: 13px; cursor: pointer;
}
.chip:hover { border-color: var(--line-hover); }
.chipValue { color: var(--muted); }
.chipSelect {
  appearance: none; background: transparent; border: 0; color: var(--muted); font: inherit; cursor: pointer; padding-right: 2px;
}
.segmented { display: inline-flex; height: 40px; border-radius: var(--radius-pill); border: 1px solid var(--line); background: rgba(23, 22, 30, 0.85); overflow: hidden; }
.segment { height: 40px; border: 0; border-radius: 0; background: transparent; color: var(--muted); }
.segmentActive { background: var(--line); color: var(--text); }
.iconBtn {
  position: absolute; right: 24px; bottom: 24px; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--line); background: rgba(23, 22, 30, 0.85); color: var(--text);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}
.iconBtn:hover { border-color: var(--line-hover); }
.toast {
  position: absolute; left: 50%; top: 20px; transform: translateX(-50%); max-width: 80%;
  padding: 10px 16px; border-radius: 12px; border: 1px solid var(--line); background: rgba(23, 22, 30, 0.95);
  color: var(--text); font-size: 13px;
}
.overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 32px; text-align: center; color: var(--muted); background: rgba(15, 14, 20, 0.7);
}
.overlayError { color: var(--error); white-space: pre-wrap; }

/* 面板 */
.panel {
  flex: 1 1 480px; max-width: 480px; min-width: 0; display: flex; flex-direction: column;
  border-left: 1px solid var(--line-soft); background: var(--panel);
}
@media (max-width: 1000px) { .panel { max-width: none; border-left: 0; border-top: 1px solid var(--line-soft); } }
.section { padding: 20px 20px 0; display: flex; flex-direction: column; gap: 12px; }
.sectionHead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.sectionTitle { margin: 0; font-size: 19px; }
.sectionHint { font-size: 12px; color: var(--muted); }
.presetGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.presetCard {
  display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: var(--radius-card);
  border: 1px solid var(--line); background: var(--card); color: var(--text); text-align: left; cursor: pointer;
}
.presetCard:hover { border-color: var(--line-hover); }
.presetCardActive { border: 1.5px solid var(--accent); }
.presetSwatch { width: 44px; height: 44px; border-radius: 10px; flex: none; }
.presetName { font-weight: 700; font-size: 14px; }
.presetMeta { font-size: 12px; color: var(--muted); }
.tabs { display: flex; gap: 4px; padding: 20px 20px 0; border-bottom: 1px solid var(--line-soft); overflow-x: auto; }
.tab {
  display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 58px; padding: 8px 6px 10px;
  border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent;
  color: var(--muted); font-size: 12px; cursor: pointer;
}
.tabActive { color: var(--text); border-bottom-color: var(--accent); }
.gridHead { padding: 16px 20px 0; display: flex; align-items: baseline; justify-content: space-between; }
.gridTitle { font-weight: 700; font-size: 14px; }
.grid {
  padding: 12px 20px 20px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
  align-content: start; flex: 1; overflow-y: auto;
}
.part {
  display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: var(--radius-card);
  border: 1px solid var(--line); background: var(--card); color: var(--text); text-align: left; cursor: pointer; position: relative;
}
.part:hover { border-color: var(--line-hover); }
.partSelected { border: 1.5px solid var(--accent); box-shadow: 0 0 0 3px rgba(232, 164, 69, 0.12); }
.partLoading { border-style: dashed; }
.partError { opacity: 0.45; cursor: not-allowed; }
.thumb { display: block; width: 100%; aspect-ratio: 1 / 1; border-radius: 10px; background: var(--card-raised); overflow: hidden; }
.thumb img { width: 100%; height: 100%; object-fit: contain; display: block; }
.thumbNone { background: repeating-linear-gradient(45deg, var(--card-raised) 0 6px, #17161E 6px 12px); border: 1px dashed var(--line-hover); }
.thumbText { display: flex; align-items: center; justify-content: center; height: 100%; padding: 8px; font-size: 12px; color: var(--muted); text-align: center; }
.partLabel { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 13px; line-height: 1.3; }
.partLabelSelected { font-weight: 700; }
.partNote { font-size: 11px; color: var(--muted); }
.spin { animation: spin 1.1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.footer {
  padding: 14px 20px; border-top: 1px solid var(--line-soft); display: flex; align-items: center; justify-content: space-between;
  gap: 12px; font-size: 12px; color: var(--muted);
}
.footerBtn { height: 32px; padding: 0 12px; font-size: 12px; }
```

- [ ] **Step 3: 新建 TopBar.tsx**

```tsx
'use client'
import Link from 'next/link'
import styles from './dressup.module.css'

export default function TopBar({ onPoster }: { onPoster?: () => void }) {
  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}>
        <span className={`font-mark ${styles.brandMark}`}>AVATAR DRESSUP</span>
        <span className={styles.brandSub}>换装台</span>
      </Link>
      <nav className={styles.topbarNav} aria-label="主导航">
        <button type="button" className="btn-primary" onClick={onPoster} disabled={!onPoster}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
          </svg>
          生成海报
        </button>
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: 新建 Viewport.tsx**

```tsx
'use client'
import { useEffect, useState, type RefObject } from 'react'
import { useStore } from 'zustand'
import { selectBase } from '@/state/avatarStore'
import { useDressUp } from './DressUpContext'
import styles from './dressup.module.css'

type Focus = 'body' | 'head'

export default function Viewport({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { manifest, store, viewer, loadingIds, errors } = useDressUp()
  const base = useStore(store, (s) => selectBase(manifest, s))
  const [focus, setFocus] = useState<Focus>('body')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const baseError = manifest.bases.map((b) => errors.get(b.id)).find(Boolean)
  const busy = loadingIds.size > 0
  const animLabel = manifest.animations[0]?.label ?? '无'

  function changeBase(id: string) {
    const next = manifest.bases.find((b) => b.id === id)
    if (!next || next.id === base.id) return
    const removed = store.getState().setBase(next)
    if (removed.length) setToast(`已卸下 ${removed.length} 件不匹配的部件：${removed.map((p) => p.label).join('、')}`)
  }

  function changeFocus(f: Focus) {
    setFocus(f)
    viewer?.focus(f)
  }

  function screenshot() {
    if (!viewer) return
    const url = viewer.screenshot()
    const a = document.createElement('a')
    a.href = url
    a.download = `avatar-${Date.now()}.jpg`
    a.click()
  }

  return (
    <section className={styles.viewport} aria-label="3D 视口">
      <div ref={containerRef} className={styles.canvasHost} />
      <div className={styles.hint}>
        <span className={`${styles.dot} ${busy ? styles.dotBusy : ''}`} />
        {busy ? '加载中' : '实时 3D'} · 拖动旋转 · 滚轮缩放
      </div>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
      {baseError && (
        <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">底模加载失败：{baseError}</div>
      )}
      <div className={styles.chips}>
        <label className={styles.chip}>
          底模
          <select
            className={styles.chipSelect}
            value={base.id}
            onChange={(e) => changeBase(e.target.value)}
            aria-label="切换底模"
          >
            {manifest.bases.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.segmented} role="group" aria-label="相机视角">
          <button type="button" className={`${styles.segment} ${focus === 'body' ? styles.segmentActive : ''}`} onClick={() => changeFocus('body')}>全身</button>
          <button type="button" className={`${styles.segment} ${focus === 'head' ? styles.segmentActive : ''}`} onClick={() => changeFocus('head')}>头部</button>
        </div>
        <span className={styles.chip}>动画 <span className={styles.chipValue}>{animLabel}</span></span>
      </div>
      <button type="button" className={styles.iconBtn} aria-label="截图下载" title="截图下载" onClick={screenshot} disabled={!viewer}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>
    </section>
  )
}
```

- [ ] **Step 5: 新建 DressUp.tsx**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { Manifest } from '@/types/manifest'
import { loadManifest } from '@/data/manifest'
import { assetUrl } from '@/data/assetUrl'
import { createAvatarStore, type AvatarStore } from '@/state/avatarStore'
import { createViewerSync } from '@/state/viewerSync'
import { AvatarViewer } from '@/avatar/AvatarViewer'
import { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'
import { DressUpContext } from './DressUpContext'
import TopBar from './TopBar'
import Viewport from './Viewport'
import styles from './dressup.module.css'

type Phase =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: Manifest; store: AvatarStore }

const GROUND = '#0F0E14'

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function DressUp() {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewer, setViewer] = useState<AvatarViewer | null>(null)
  const [thumbs, setThumbs] = useState<ThumbnailRenderer | null>(null)
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map())

  // 读 manifest，校验失败整页报错
  useEffect(() => {
    let cancelled = false
    loadManifest()
      .then((manifest) => {
        if (!cancelled) setPhase({ status: 'ready', manifest, store: createAvatarStore(manifest) })
      })
      .catch((e: unknown) => {
        if (!cancelled) setPhase({ status: 'error', message: reasonOf(e) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // manifest 就绪且容器挂上后建 3D；严格模式会执行两遍，清理函数必须把一切释放干净
  useEffect(() => {
    if (phase.status !== 'ready' || !containerRef.current) return
    const { manifest, store } = phase
    let v: AvatarViewer
    try {
      v = new AvatarViewer(containerRef.current, assetUrl, { background: GROUND })
    } catch (e) {
      setPhase({ status: 'error', message: `无法创建 3D 视口，浏览器可能不支持 WebGL。${reasonOf(e)}` })
      return
    }
    v.on('loading', (stage, id) => {
      setLoadingIds((prev) => {
        const next = new Set(prev)
        if (stage === 'start') next.add(id)
        else next.delete(id)
        return next
      })
    })
    const sync = createViewerSync(store, v, manifest, (id, err) => {
      setErrors((prev) => new Map(prev).set(id, reasonOf(err)))
    })
    const t = new ThumbnailRenderer(v.loader, assetUrl)
    setViewer(v)
    setThumbs(t)
    return () => {
      sync.stop()
      t.dispose()
      v.dispose()
      setViewer(null)
      setThumbs(null)
      setLoadingIds(new Set())
      setErrors(new Map())
    }
  }, [phase])

  if (phase.status === 'loading') {
    return (
      <div className={styles.layout}>
        <TopBar />
        <div className={styles.overlay}>正在读取部件清单…</div>
      </div>
    )
  }
  if (phase.status === 'error') {
    return (
      <div className={styles.layout}>
        <TopBar />
        <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">{phase.message}</div>
      </div>
    )
  }

  return (
    <DressUpContext.Provider value={{ manifest: phase.manifest, store: phase.store, viewer, thumbs, loadingIds, errors }}>
      <div className={styles.layout}>
        <TopBar />
        <div className={styles.main}>
          <Viewport containerRef={containerRef} />
          <aside className={styles.panel} aria-label="部件面板" />
        </div>
      </div>
    </DressUpContext.Provider>
  )
}
```

- [ ] **Step 6: 换装页挂上 DressUp**

`app/create/page.tsx` 整个替换为：

```tsx
import type { Metadata } from 'next'
import DressUp from '../../components/DressUp'

export const metadata: Metadata = { title: '换装台 · Avatar Dressup' }

export default function CreatePage() {
  return <DressUp />
}
```

- [ ] **Step 7: 类型检查与浏览器验证**

Run: `npm run typecheck && npm run dev`

打开 `http://localhost:3000/create`，预期：

- 先短暂显示「正在读取部件清单」，然后出现女性底模，站在圆形阴影上，在做待机动画。
- 鼠标拖动能旋转，滚轮能缩放，不能平移。
- 左下角「底模」下拉切到男性，模型换成男性，待机动画继续。
- 「头部」分段按钮让相机 0.4 秒内推到脸部，「全身」拉回。
- 右下角截图按钮下载一张 768 乘 1152 的 jpg。
- 开发者工具 Console 没有红色报错；React 严格模式下视口只有一个 canvas（说明清理函数干净）。

- [ ] **Step 8: 提交**

```bash
git add components app/create/page.tsx
git commit -m "feat: 换装页骨架，视口渲染底模与待机动画

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 部件面板：套装、部位、网格、缩略图

**Files:**
- Create: `components/SlotIcon.tsx`、`components/PartCard.tsx`、`components/PartsPanel.tsx`
- Modify: `components/DressUp.tsx`（把空 aside 换成 `<PartsPanel />`）

**Interfaces:**
- Consumes: Task 6 `useDressUp`、`dressup.module.css`；Task 2 selector：`selectBase`、`selectVisibleSlots`、`selectPartsInActiveSlot`、`selectEquippedIds`、`selectEquippedCount`、`selectCurrentPreset`。
- Produces: `<PartsPanel />`，无 props；`<PartCard part selected loading error onClick />`；`<SlotIcon slotId />`。

- [ ] **Step 1: 新建 SlotIcon.tsx**

```tsx
const PATHS: Record<string, string> = {
  hair: 'M5 20c0-6 1-11 7-14 6 3 7 8 7 14M5 20c2-3 2-7 1-10M19 20c-2-3-2-7-1-10M9 20c0-4 1-7 3-9 2 2 3 5 3 9',
  eyebrows: 'M3 10c2-2.5 5-3 8-1.5M21 10c-2-2.5-5-3-8-1.5M5 16c1.5-1 3-1.3 5-.5M19 16c-1.5-1-3-1.3-5-.5',
  body: 'M8 4l4 2 4-2 4 3-2 4-2-1v11H8V10l-2 1-2-4z',
  arms: 'M6 4h5l2 7-2 9H8l-2-9zM11 11h5M9 20v1M13 20v1',
  legs: 'M7 3h10l-1 9 1 9h-4l-1-9-1 9H7l1-9z',
  feet: 'M7 4h6v8l6 3v4H4v-5l3-2z',
  accessory: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6 6.6 19.6l1.2-6.1L3.3 9.3l6.1-.7z',
}

export default function SlotIcon({ slotId }: { slotId: string }) {
  const d = PATHS[slotId] ?? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
```

- [ ] **Step 2: 新建 PartCard.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { Part } from '@/types/manifest'
import { useDressUp } from './DressUpContext'
import styles from './dressup.module.css'

interface Props {
  part: Part
  selected: boolean
  loading: boolean
  error?: string
  onClick: () => void
}

export default function PartCard({ part, selected, loading, error, onClick }: Props) {
  const { thumbs } = useDressUp()
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!thumbs) return
    let alive = true
    thumbs.get(part).then((url) => { if (alive) setThumb(url) }).catch(() => undefined)
    return () => { alive = false }
  }, [thumbs, part])

  const cls = [
    styles.part,
    selected ? styles.partSelected : '',
    loading ? styles.partLoading : '',
    error ? styles.partError : '',
  ].join(' ')

  return (
    <button type="button" className={cls} onClick={onClick} disabled={!!error} title={error ?? part.label} aria-pressed={selected}>
      <span className={styles.thumb}>
        {thumb ? <img src={thumb} alt="" /> : <span className={styles.thumbText}>{part.label}</span>}
      </span>
      <span className={`${styles.partLabel} ${selected ? styles.partLabelSelected : ''}`}>
        {part.label}
        {selected && !loading && (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        )}
        {loading && (
          <svg aria-hidden="true" className={styles.spin} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-6.4 2.6" /></svg>
        )}
      </span>
      {error && <span className={styles.partNote}>加载失败</span>}
    </button>
  )
}
```

- [ ] **Step 3: 新建 PartsPanel.tsx**

```tsx
'use client'
import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Preset } from '@/types/manifest'
import {
  selectBase, selectCurrentPreset, selectEquippedCount, selectEquippedIds, selectPartsInActiveSlot, selectVisibleSlots,
} from '@/state/avatarStore'
import { useDressUp } from './DressUpContext'
import PartCard from './PartCard'
import SlotIcon from './SlotIcon'
import styles from './dressup.module.css'

/** 套装卡上的色块：按套装名取色，没列的用默认 */
const PRESET_SWATCH: Record<string, string> = {
  ranger: 'linear-gradient(135deg, #5A6A42, #2B3322)',
  peasant: 'linear-gradient(135deg, #8A6B4A, #4A3826)',
}

export default function PartsPanel() {
  const { manifest, store, loadingIds, errors } = useDressUp()
  const activeSlot = useStore(store, (s) => s.activeSlot)
  const base = useStore(store, (s) => selectBase(manifest, s))
  const visibleSlots = useStore(store, useShallow((s) => selectVisibleSlots(manifest, s)))
  const parts = useStore(store, useShallow((s) => selectPartsInActiveSlot(manifest, s)))
  const equippedIds = useStore(store, useShallow((s) => selectEquippedIds(s)))
  const count = useStore(store, selectEquippedCount)
  const currentPreset = useStore(store, (s) => selectCurrentPreset(manifest, s))

  // 当前底模下激活的槽位没有部件时，跳到第一个有部件的槽位
  useEffect(() => {
    if (visibleSlots.length && !visibleSlots.some((s) => s.id === activeSlot)) {
      store.getState().setActiveSlot(visibleSlots[0].id)
    }
  }, [visibleSlots, activeSlot, store])

  const slot = manifest.slots.find((s) => s.id === activeSlot)
  // 从已订阅的派生值推出来，不在渲染期读 getState
  const slotEmpty = !parts.some((p) => equippedIds.includes(p.id))
  const hint = slot ? (slot.multiple ? '可多选' : '单选') : ''

  function presetMeta(p: Preset): string {
    const n = Object.keys(p.parts).length
    return currentPreset?.id === p.id ? `${n} 件 · 已装` : `${n} 件`
  }

  return (
    <aside className={styles.panel} aria-label="部件面板">
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={`font-display ${styles.sectionTitle}`}>一键套装</h2>
          <span className={styles.sectionHint}>装上一件会自动补齐整套</span>
        </div>
        <div className={styles.presetGrid}>
          {manifest.presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.presetCard} ${currentPreset?.id === p.id ? styles.presetCardActive : ''}`}
              onClick={() => store.getState().applyPreset(p)}
            >
              <span aria-hidden="true" className={styles.presetSwatch} style={{ background: PRESET_SWATCH[p.id] ?? 'linear-gradient(135deg, #4A4458, #2A2634)' }} />
              <span>
                <span className={styles.presetName}>{p.label}</span>
                <br />
                <span className={styles.presetMeta}>{presetMeta(p)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="部位">
        {visibleSlots.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeSlot}
            className={`${styles.tab} ${s.id === activeSlot ? styles.tabActive : ''}`}
            onClick={() => store.getState().setActiveSlot(s.id)}
          >
            <SlotIcon slotId={s.id} />
            {s.label}
          </button>
        ))}
      </div>

      <div className={styles.gridHead}>
        <span className={styles.gridTitle}>{slot?.label ?? ''}</span>
        <span className={styles.sectionHint}>{hint}</span>
      </div>

      <div className={styles.grid}>
        {slot && !slot.multiple && (
          <button
            type="button"
            className={`${styles.part} ${slotEmpty ? styles.partSelected : ''}`}
            onClick={() => store.getState().unequip(slot.id)}
            aria-pressed={slotEmpty}
          >
            <span className={`${styles.thumb} ${styles.thumbNone}`} />
            <span className={`${styles.partLabel} ${slotEmpty ? styles.partLabelSelected : ''}`}>无</span>
          </button>
        )}
        {parts.map((p) => (
          <PartCard
            key={p.id}
            part={p}
            selected={equippedIds.includes(p.id)}
            loading={loadingIds.has(p.id)}
            error={errors.get(p.id)}
            onClick={() => store.getState().toggle(p)}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <span>已装 {count} 件 · {currentPreset?.label ?? '混搭'} · {base.label}</span>
        <button type="button" className={`btn-ghost ${styles.footerBtn}`} onClick={() => store.getState().reset()}>重置</button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: DressUp 挂上面板**

`components/DressUp.tsx` 顶部加一行 import：

```tsx
import PartsPanel from './PartsPanel'
```

把

```tsx
          <aside className={styles.panel} aria-label="部件面板" />
```

改为

```tsx
          <PartsPanel />
```

- [ ] **Step 5: 类型检查与浏览器验证，M1 与 M2**

Run: `npm run typecheck && npm run dev`，打开 `http://localhost:3000/create`。

M1 验收：

- 部位 tab 点「上身」，点「游侠 上衣」。四件游侠服装一起穿上，缩略图卡片变成金色描边。
- 上衣贴合底模，肩、腰、袖口没有错位；待机动画时衣服跟着身体一起动。记录穿模情况（紧身衣露出的位置），写进提交信息。
- 底模切到男性：四件女装被卸下并提示；再点「游侠」套装卡，男装四件穿上，看肩甲和腰带有无错位。

M2 验收：

- 七个部位 tab 都能切，没有部件的槽位不显示。
- 每个部件卡片在一两秒内出现缩略图。
- 「无」卡片能卸下单选槽位；配饰可以同时装肩甲和兜帽，再点一次卸下。
- 点「农夫」套装卡整套替换；再单独换一条「游侠 长裤」，页脚显示「混搭」。
- 「重置」后页脚显示「已装 0 件」。
- 拔掉网络后（开发者工具 Offline）点一个没加载过的部件，卡片置灰显示「加载失败」，其余不受影响。

- [ ] **Step 6: 提交**

```bash
git add components
git commit -m "feat: 部件面板，套装、部位、网格与缩略图

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 海报适配器与请求校验

**Files:**
- Create: `src/poster/types.ts`、`src/poster/request.ts`、`src/poster/mock.ts`、`src/poster/index.ts`
- Create: `tests/poster.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `POSTER_STYLES = ['fantasy','anime','watercolor','cyberpunk'] as const`；`type PosterStyle`；`POSTER_STYLE_LABELS: Record<PosterStyle, string>`；`POSTER_WIDTH = 768`；`POSTER_HEIGHT = 1152`；`MAX_IMAGE_BYTES = 4 MB`；`isPosterStyle(v): v is PosterStyle`
  - `interface PosterInput { image: Buffer; style: PosterStyle }`；`interface PosterProvider { readonly id: string; generate(input: PosterInput): Promise<Buffer> }`
  - `parsePosterRequest(body: unknown): { ok: true; input: PosterInput } | { ok: false; error: string }`
  - `mockProvider: PosterProvider`
  - `getPosterProvider(env?: NodeJS.ProcessEnv): PosterProvider`，未配置时抛 `Error('海报服务未配置: POSTER_PROVIDER=<值>')`

- [ ] **Step 1: 写失败的测试**

新建 `tests/poster.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { parsePosterRequest } from '@/poster/request'
import { getPosterProvider } from '@/poster/index'
import { mockProvider } from '@/poster/mock'
import { POSTER_HEIGHT, POSTER_WIDTH } from '@/poster/types'

const PREFIX = 'data:image/jpeg;base64,'

async function jpegDataUrl(width = 64, height = 96): Promise<string> {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 60 } } })
    .jpeg()
    .toBuffer()
  return PREFIX + buf.toString('base64')
}

describe('parsePosterRequest', () => {
  it('合法请求解析出 JPEG Buffer 与风格', async () => {
    const r = parsePosterRequest({ image: await jpegDataUrl(), style: 'anime' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.input.style).toBe('anime')
      expect([r.input.image[0], r.input.image[1]]).toEqual([0xff, 0xd8])
    }
  })

  it('不是对象、不是 data URL、不是 JPEG 都报同一句', async () => {
    const msg = { ok: false, error: '图片必须是 JPEG data URL' }
    expect(parsePosterRequest(null)).toEqual(msg)
    expect(parsePosterRequest({ image: 'hello', style: 'anime' })).toEqual(msg)
    expect(parsePosterRequest({ image: 'data:image/png;base64,AAAA', style: 'anime' })).toEqual(msg)
    const notJpeg = PREFIX + Buffer.from('not a jpeg at all').toString('base64')
    expect(parsePosterRequest({ image: notJpeg, style: 'anime' })).toEqual(msg)
  })

  it('超过 4 MB 在解码前就拒绝', () => {
    const huge = PREFIX + 'A'.repeat(6 * 1024 * 1024)
    expect(parsePosterRequest({ image: huge, style: 'anime' })).toEqual({ ok: false, error: '图片超过 4 MB' })
  })

  it('未知风格', async () => {
    expect(parsePosterRequest({ image: await jpegDataUrl(), style: 'oil' })).toEqual({ ok: false, error: '未知风格' })
    expect(parsePosterRequest({ image: await jpegDataUrl() })).toEqual({ ok: false, error: '未知风格' })
  })
})

describe('getPosterProvider', () => {
  it('mock 返回假适配器', () => {
    expect(getPosterProvider({ POSTER_PROVIDER: 'mock' }).id).toBe('mock')
  })

  it('未设置或拼错时抛错并带上值，不静默回退', () => {
    expect(() => getPosterProvider({})).toThrow('海报服务未配置: POSTER_PROVIDER=')
    expect(() => getPosterProvider({ POSTER_PROVIDER: 'openai' })).toThrow('海报服务未配置: POSTER_PROVIDER=openai')
  })
})

describe('mockProvider', () => {
  it('四种风格都输出 768 乘 1152 的 JPEG，且彼此不同', async () => {
    const src = Buffer.from((await jpegDataUrl(300, 450)).slice(PREFIX.length), 'base64')
    const outs: string[] = []
    for (const style of ['fantasy', 'anime', 'watercolor', 'cyberpunk'] as const) {
      const out = await mockProvider.generate({ image: src, style })
      const meta = await sharp(out).metadata()
      expect(meta.format).toBe('jpeg')
      expect(meta.width).toBe(POSTER_WIDTH)
      expect(meta.height).toBe(POSTER_HEIGHT)
      outs.push(out.toString('base64'))
    }
    expect(new Set(outs).size).toBe(4)
  }, 20000)
})
```

- [ ] **Step 2: 跑确认失败**

Run: `npx vitest run tests/poster.test.ts`
Expected: FAIL，四个模块都找不到。

- [ ] **Step 3: 新建 types.ts**

```ts
export const POSTER_STYLES = ['fantasy', 'anime', 'watercolor', 'cyberpunk'] as const
export type PosterStyle = (typeof POSTER_STYLES)[number]

export const POSTER_STYLE_LABELS: Record<PosterStyle, string> = {
  fantasy: '奇幻插画',
  anime: '动漫',
  watercolor: '水彩',
  cyberpunk: '赛博朋克',
}

export const POSTER_WIDTH = 768
export const POSTER_HEIGHT = 1152
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export interface PosterInput {
  image: Buffer
  style: PosterStyle
}

/** 一个方法：收图出图。真实服务与假适配器都实现它。 */
export interface PosterProvider {
  readonly id: string
  generate(input: PosterInput): Promise<Buffer>
}

export function isPosterStyle(v: unknown): v is PosterStyle {
  return typeof v === 'string' && (POSTER_STYLES as readonly string[]).includes(v)
}
```

- [ ] **Step 4: 新建 request.ts**

```ts
import { isPosterStyle, MAX_IMAGE_BYTES, type PosterInput } from './types'

export type ParseResult = { ok: true; input: PosterInput } | { ok: false; error: string }

const PREFIX = 'data:image/jpeg;base64,'
const BAD_IMAGE = '图片必须是 JPEG data URL'

/** 校验 /api/poster 的请求体。体积先按 base64 长度估算，超限时不解码。 */
export function parsePosterRequest(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: BAD_IMAGE }
  const { image, style } = body as { image?: unknown; style?: unknown }
  if (typeof image !== 'string' || !image.startsWith(PREFIX)) return { ok: false, error: BAD_IMAGE }
  const b64 = image.slice(PREFIX.length)
  if (Math.floor((b64.length * 3) / 4) > MAX_IMAGE_BYTES) return { ok: false, error: '图片超过 4 MB' }
  if (!isPosterStyle(style)) return { ok: false, error: '未知风格' }
  const buf = Buffer.from(b64, 'base64')
  // JPEG 文件头 FF D8
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) return { ok: false, error: BAD_IMAGE }
  return { ok: true, input: { image: buf, style } }
}
```

- [ ] **Step 5: 新建 mock.ts**

```ts
import sharp from 'sharp'
import { POSTER_HEIGHT, POSTER_WIDTH, type PosterInput, type PosterProvider, type PosterStyle } from './types'

interface StyleParams {
  /** 色相偏移，度 */
  hue: number
  saturation: number
  brightness: number
  /** sharp 要求 1.0 到 3.0 */
  gamma: number
  /** 保留明度、替换色相的双色调染色 */
  tint: { r: number; g: number; b: number }
  band: string
  title: string
}

/** 四种风格各一套调色；标题栏只用英文，容器里不一定有中文字体 */
const STYLE_PARAMS: Record<PosterStyle, StyleParams> = {
  fantasy: { hue: -10, saturation: 1.15, brightness: 0.95, gamma: 1.1, tint: { r: 232, g: 180, b: 110 }, band: '#2B2416', title: 'FANTASY' },
  anime: { hue: 15, saturation: 1.45, brightness: 1.08, gamma: 1.0, tint: { r: 255, g: 196, b: 232 }, band: '#2A1A2E', title: 'ANIME' },
  watercolor: { hue: 0, saturation: 0.7, brightness: 1.12, gamma: 1.0, tint: { r: 222, g: 226, b: 240 }, band: '#1E2230', title: 'WATERCOLOR' },
  cyberpunk: { hue: 190, saturation: 1.5, brightness: 0.92, gamma: 1.25, tint: { r: 120, g: 220, b: 255 }, band: '#101A2A', title: 'CYBERPUNK' },
}

function bandSvg(p: StyleParams, date: string): Buffer {
  const h = 120
  const y = POSTER_HEIGHT - h
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}">` +
      `<rect x="0" y="${y}" width="${POSTER_WIDTH}" height="${h}" fill="${p.band}" fill-opacity="0.88"/>` +
      `<rect x="0" y="${y}" width="${POSTER_WIDTH}" height="2" fill="#E8A445"/>` +
      `<text x="40" y="${POSTER_HEIGHT - 48}" font-family="sans-serif" font-size="40" font-weight="700" letter-spacing="6" fill="#E8A445">${p.title}</text>` +
      `<text x="${POSTER_WIDTH - 40}" y="${POSTER_HEIGHT - 48}" font-family="sans-serif" font-size="22" text-anchor="end" fill="#A09DAE">AVATAR DRESSUP · ${date}</text>` +
      `</svg>`,
  )
}

/** 演示用假适配器：缩放、调色、双色调、底部标题栏。接口与真实服务相同。 */
export const mockProvider: PosterProvider = {
  id: 'mock',
  async generate({ image, style }: PosterInput): Promise<Buffer> {
    const p = STYLE_PARAMS[style]
    const date = new Date().toISOString().slice(0, 10)
    return sharp(image)
      .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: 'cover' })
      .modulate({ brightness: p.brightness, saturation: p.saturation, hue: p.hue })
      .gamma(p.gamma)
      .tint(p.tint)
      .composite([{ input: bandSvg(p, date), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer()
  },
}
```

- [ ] **Step 6: 新建 index.ts**

```ts
import { mockProvider } from './mock'
import type { PosterProvider } from './types'

/** 按环境变量选适配器。不认识的值直接抛错，绝不静默回退到假的。 */
export function getPosterProvider(env: NodeJS.ProcessEnv = process.env): PosterProvider {
  const id = env.POSTER_PROVIDER ?? ''
  if (id === 'mock') return mockProvider
  throw new Error(`海报服务未配置: POSTER_PROVIDER=${id}`)
}
```

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run tests/poster.test.ts`
Expected: 7 passed。本机 Windows 上 sharp 的 SVG 文字能渲染；容器里的字体在 Task 11 的 Dockerfile 里装。

- [ ] **Step 8: 类型检查后提交**

Run: `npm run typecheck`

```bash
git add src/poster tests/poster.test.ts
git commit -m "feat: 海报适配器接口、请求校验与 sharp 假适配器

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 海报路由、弹窗与截图接入

**Files:**
- Create: `app/api/poster/route.ts`
- Create: `tests/posterRoute.test.ts`
- Create: `components/PosterDialog.tsx`、`components/poster.module.css`
- Modify: `components/DressUp.tsx`

**Interfaces:**
- Consumes: Task 8 全部；Task 6 `TopBar onPoster`、`AvatarViewer.screenshot()`。
- Produces: `POST /api/poster`（契约见 Global Constraints）；`<PosterDialog open onClose screenshot />`。

- [ ] **Step 1: 写路由的失败测试**

新建 `tests/posterRoute.test.ts`：

```ts
import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { POST } from '../app/api/poster/route'

const original = process.env.POSTER_PROVIDER
afterEach(() => {
  if (original === undefined) delete process.env.POSTER_PROVIDER
  else process.env.POSTER_PROVIDER = original
})

function req(body: unknown): Request {
  return new Request('http://localhost/api/poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function jpegDataUrl(): Promise<string> {
  const buf = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#806050' } }).jpeg().toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

describe('POST /api/poster', () => {
  it('请求体不是 JSON 时 400', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '图片必须是 JPEG data URL' })
  })

  it('校验失败时 400 带固定文案', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req({ image: await jpegDataUrl(), style: 'oil' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '未知风格' })
  })

  it('未配置适配器时 500 带说明', async () => {
    delete process.env.POSTER_PROVIDER
    const res = await POST(req({ image: await jpegDataUrl(), style: 'anime' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('海报服务未配置: POSTER_PROVIDER=')
  })

  it('成功时返回 image/jpeg 且不缓存', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req({ image: await jpegDataUrl(), style: 'fantasy' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const buf = Buffer.from(await res.arrayBuffer())
    expect((await sharp(buf).metadata()).width).toBe(768)
  }, 20000)
})
```

- [ ] **Step 2: 跑确认失败**

Run: `npx vitest run tests/posterRoute.test.ts`
Expected: FAIL，找不到 `../app/api/poster/route`。

- [ ] **Step 3: 新建路由**

`app/api/poster/route.ts`：

```ts
import { getPosterProvider } from '@/poster/index'
import { parsePosterRequest } from '@/poster/request'

export const runtime = 'nodejs'

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError(400, '图片必须是 JPEG data URL')
  }
  const parsed = parsePosterRequest(body)
  if (!parsed.ok) return jsonError(400, parsed.error)

  let provider
  try {
    provider = getPosterProvider()
  } catch (e) {
    return jsonError(500, reasonOf(e))
  }

  try {
    const out = await provider.generate(parsed.input)
    return new Response(new Uint8Array(out), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return jsonError(500, `海报生成失败：${reasonOf(e)}`)
  }
}
```

- [ ] **Step 4: 跑路由测试确认通过**

Run: `npx vitest run tests/posterRoute.test.ts`
Expected: 4 passed。

- [ ] **Step 5: 新建 poster.module.css**

```css
.backdrop {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(15, 14, 20, 0.78);
}
.dialog {
  width: min(560px, 100%); max-height: 92vh; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
  padding: 24px; border-radius: 20px; border: 1px solid var(--line); background: var(--panel); color: var(--text);
}
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title { margin: 0; font-size: 24px; }
.close {
  width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--card);
  color: var(--text); font-size: 20px; line-height: 1; cursor: pointer;
}
.lead { margin: 0; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }
.chip {
  height: 40px; padding: 0 16px; border-radius: var(--radius-pill); border: 1px solid var(--line);
  background: var(--card); color: var(--text); font-size: 14px; cursor: pointer;
}
.chip:hover { border-color: var(--line-hover); }
.chipActive { border: 1.5px solid var(--accent); color: var(--accent); }
.actions { display: flex; justify-content: flex-end; gap: 12px; }
.busy { display: flex; flex-direction: column; align-items: center; gap: 16px; color: var(--muted); }
.skeleton {
  width: 220px; aspect-ratio: 2 / 3; border-radius: 14px;
  background: linear-gradient(100deg, var(--card) 30%, var(--card-raised) 50%, var(--card) 70%);
  background-size: 200% 100%; animation: shimmer 1.4s linear infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
.result { display: block; width: 100%; max-height: 60vh; object-fit: contain; border-radius: 14px; background: var(--ground); }
.error { margin: 0; color: var(--error); }
```

- [ ] **Step 6: 新建 PosterDialog.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { POSTER_STYLES, POSTER_STYLE_LABELS, type PosterStyle } from '@/poster/types'
import styles from './poster.module.css'

type State =
  | { kind: 'pick' }
  | { kind: 'busy' }
  | { kind: 'done'; url: string; style: PosterStyle }
  | { kind: 'error'; message: string }

const STYLE_KEY = 'avatar-dressup:poster-style'

interface Props {
  open: boolean
  onClose: () => void
  /** 返回当前视口的 JPEG data URL */
  screenshot: () => string
}

export default function PosterDialog({ open, onClose, screenshot }: Props) {
  const [style, setStyle] = useState<PosterStyle>('fantasy')
  const [state, setState] = useState<State>({ kind: 'pick' })

  // 记住上次选的风格；localStorage 不可用时忽略
  useEffect(() => {
    try {
      const s = localStorage.getItem(STYLE_KEY)
      if (s && (POSTER_STYLES as readonly string[]).includes(s)) setStyle(s as PosterStyle)
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    if (!open) setState({ kind: 'pick' })
  }, [open])

  // 离开 done 态或卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (state.kind === 'done') URL.revokeObjectURL(state.url)
    }
  }, [state])

  function pick(s: PosterStyle) {
    setStyle(s)
    try {
      localStorage.setItem(STYLE_KEY, s)
    } catch {
      // 忽略
    }
  }

  async function generate() {
    setState({ kind: 'busy' })
    try {
      const image = screenshot()
      const res = await fetch('/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, style }),
      })
      if (!res.ok) {
        let message = `请求失败（HTTP ${res.status}）`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // 响应不是 JSON，保留默认文案
        }
        setState({ kind: 'error', message })
        return
      }
      const blob = await res.blob()
      setState({ kind: 'done', url: URL.createObjectURL(blob), style })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!open) return null
  const fileName = `avatar-poster-${style}-${new Date().toISOString().slice(0, 10)}.jpg`

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="poster-title">
      <div className={styles.dialog}>
        <div className={styles.head}>
          <h2 id="poster-title" className={`font-display ${styles.title}`}>生成海报</h2>
          <button type="button" className={styles.close} aria-label="关闭" onClick={onClose}>×</button>
        </div>

        {state.kind === 'pick' && (
          <>
            <p className={styles.lead}>选一种风格，把当前形象交给 AI 画成一张海报。</p>
            <div className={styles.chips} role="radiogroup" aria-label="风格">
              {POSTER_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === style}
                  className={`${styles.chip} ${s === style ? styles.chipActive : ''}`}
                  onClick={() => pick(s)}
                >
                  {POSTER_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={onClose}>取消</button>
              <button type="button" className="btn-primary" onClick={generate}>生成</button>
            </div>
          </>
        )}

        {state.kind === 'busy' && (
          <div className={styles.busy} aria-live="polite">
            <div className={styles.skeleton} />
            <p>正在渲染，约 20 秒…</p>
          </div>
        )}

        {state.kind === 'done' && (
          <>
            <img className={styles.result} src={state.url} alt={`${POSTER_STYLE_LABELS[state.style]}风格的海报`} />
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={() => setState({ kind: 'pick' })}>换个风格</button>
              <a className="btn-primary" href={state.url} download={fileName}>下载</a>
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <p className={styles.error} role="alert">{state.message}</p>
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={onClose}>关闭</button>
              <button type="button" className="btn-primary" onClick={generate}>重试</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: DressUp 接入弹窗**

`components/DressUp.tsx` 顶部加 import：

```tsx
import PosterDialog from './PosterDialog'
```

在 `const [errors, setErrors] = ...` 下面加一行状态：

```tsx
  const [posterOpen, setPosterOpen] = useState(false)
```

把 ready 分支里的

```tsx
        <TopBar />
        <div className={styles.main}>
          <Viewport containerRef={containerRef} />
          <PartsPanel />
        </div>
```

改为

```tsx
        <TopBar onPoster={viewer ? () => setPosterOpen(true) : undefined} />
        <div className={styles.main}>
          <Viewport containerRef={containerRef} />
          <PartsPanel />
        </div>
        {viewer && (
          <PosterDialog open={posterOpen} onClose={() => setPosterOpen(false)} screenshot={() => viewer.screenshot()} />
        )}
```

- [ ] **Step 8: 本地环境变量与浏览器验证**

```bash
cp .env.example .env.local
```

Run: `npm run typecheck && npm run dev`，打开 `http://localhost:3000/create`，穿上一套衣服后：

- 点顶栏「生成海报」，弹窗出现四个风格芯片，默认「奇幻插画」。
- 点「生成」，骨架闪动不到一秒后出现海报：竖版、双色调、底部一条标题栏写着风格英文名和日期。
- 点「下载」得到 `avatar-poster-fantasy-<日期>.jpg`，用看图软件打开是 768 乘 1152。
- 「换个风格」选「赛博朋克」再生成，色调明显不同。
- 刷新页面再开弹窗，默认风格还是赛博朋克。
- 把 `.env.local` 里 `POSTER_PROVIDER` 改成 `nope`，重启 dev，生成时弹窗里显示「海报服务未配置: POSTER_PROVIDER=nope」，「重试」可点。改回 `mock`。

- [ ] **Step 9: 跑全部测试后提交**

Run: `npm test && npm run typecheck`

```bash
git add app/api components tests/posterRoute.test.ts
git commit -m "feat: 海报路由、风格弹窗与下载

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 首页介绍页

**Files:**
- Create: `components/landing/landing.module.css`、`components/landing/SiteNav.tsx`、`components/landing/Hero.tsx`、`components/landing/Features.tsx`、`components/landing/Steps.tsx`、`components/landing/SiteFooter.tsx`
- Create: `scripts/landing-webp.mjs`
- Create（脚本生成，进 git）: `public/landing/poster-fantasy.webp`、`poster-anime.webp`、`poster-cyberpunk.webp`
- Modify: `app/page.tsx`、`.gitignore`

**Interfaces:**
- Consumes: Task 3 的令牌与工具类；Task 9 的海报弹窗（用来产出三张首屏素材）。
- Produces: 路由 `/` 的完整首页，全部是服务端组件，不 import three、store、manifest。

- [ ] **Step 1: 产出三张首屏海报素材**

Run: `npm run dev`，在 `/create` 穿上游侠套装，用「生成海报」分别以奇幻插画、动漫、赛博朋克三种风格各下载一张，重命名放到：

```
public/landing/src/poster-fantasy.jpg
public/landing/src/poster-anime.jpg
public/landing/src/poster-cyberpunk.jpg
```

`.gitignore` 末尾加一行，原图不进 git：

```
public/landing/src/
```

- [ ] **Step 2: 新建 scripts/landing-webp.mjs 并运行**

```js
#!/usr/bin/env node
// 把 public/landing/src/*.jpg 缩成 480 乘 720 的 webp，写到 public/landing/。原图不进 git。
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'public', 'landing', 'src')
const OUT = path.join(ROOT, 'public', 'landing')

await mkdir(OUT, { recursive: true })
for (const f of await readdir(SRC)) {
  if (!/\.(jpe?g|png)$/i.test(f)) continue
  const out = path.join(OUT, f.replace(/\.(jpe?g|png)$/i, '.webp'))
  const info = await sharp(path.join(SRC, f)).resize(480, 720, { fit: 'cover' }).webp({ quality: 82 }).toFile(out)
  console.log(`${f} -> ${path.basename(out)} ${(info.size / 1024).toFixed(0)} KB`)
}
```

`package.json` 的 scripts 加：

```json
    "landing:webp": "node scripts/landing-webp.mjs"
```

Run: `npm run landing:webp`
Expected: 三个 webp，每个 40 到 120 KB。

- [ ] **Step 3: 新建 landing.module.css**

```css
.page { display: flex; flex-direction: column; min-height: 100vh; background: var(--ground); color: var(--text); }
.container { width: 100%; max-width: 1200px; margin: 0 auto; }

.nav {
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 16px 32px; border-bottom: 1px solid var(--line-soft);
}
.brand { color: var(--text); font-size: 17px; }
.navLinks { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.hero {
  position: relative; overflow: hidden; padding: 72px 32px 56px;
  background: radial-gradient(ellipse 55% 60% at 72% 40%, #2A2238 0%, #17141F 45%, var(--ground) 80%);
}
.heroGrid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr)); gap: 48px; align-items: center;
}
.heroCopy { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.eyebrow { font-size: 12px; letter-spacing: 0.28em; color: var(--muted); }
.title { margin: 0; font-size: clamp(36px, 5vw, 60px); line-height: 1.12; text-wrap: balance; }
.lead { margin: 0; max-width: 34em; font-size: 17px; color: var(--muted); }
.ctaRow { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.ctaLarge { height: 48px; padding: 0 26px; font-size: 16px; }
.facts { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
.fact { display: inline-flex; align-items: center; gap: 8px; }
.fact::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }

.art { position: relative; height: 520px; min-width: 0; }
.poster {
  position: absolute; top: 70px; width: 220px; height: 330px; border-radius: 16px; overflow: hidden;
  border: 1px solid var(--line-hover); box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5); background: var(--card);
}
.poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
.posterA { left: 6%; animation: floatA 6s ease-in-out infinite; }
.posterB { left: 50%; top: 20px; width: 236px; height: 354px; margin-left: -118px; z-index: 2; box-shadow: 0 36px 70px rgba(0, 0, 0, 0.55); animation: floatB 7s ease-in-out infinite; }
.posterC { right: 6%; top: 80px; animation: floatC 6.5s ease-in-out infinite; }
.badge {
  position: absolute; left: 12px; top: 12px; display: inline-flex; align-items: center; height: 22px; padding: 0 9px;
  border-radius: var(--radius-pill); background: rgba(174, 152, 242, 0.18); color: var(--ai); font-size: 10px; letter-spacing: 0.12em; font-weight: 700;
}
.posterLabel { position: absolute; left: 12px; bottom: 12px; font-size: 18px; color: var(--text); text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6); }
@keyframes floatA { 0%, 100% { transform: rotate(-7deg) translateY(0); } 50% { transform: rotate(-7deg) translateY(-10px); } }
@keyframes floatB { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes floatC { 0%, 100% { transform: rotate(7deg) translateY(0); } 50% { transform: rotate(7deg) translateY(-8px); } }
@media (max-width: 900px) { .art { height: 420px; } }

.section { padding: 64px 32px; }
.sectionInner { display: flex; flex-direction: column; gap: 28px; }
.sectionHead { display: flex; flex-direction: column; gap: 8px; }
.h2 { margin: 0; font-size: 36px; text-wrap: balance; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 20px; }
.card {
  display: flex; flex-direction: column; gap: 16px; padding: 28px; border-radius: 20px;
  border: 1px solid var(--line); background: var(--panel);
}
.card:hover { border-color: var(--line-hover); }
.icon {
  display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 14px;
  background: var(--card-raised); color: var(--accent);
}
.iconAi { color: var(--ai); }
.h3 { margin: 0; font-size: 20px; font-weight: 700; }
.p { margin: 0; color: var(--muted); }

.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 20px; }
.step { display: flex; flex-direction: column; gap: 12px; padding: 24px 0 0; border-top: 1px solid var(--line); }
.stepNo { font-size: 28px; letter-spacing: 0.1em; color: var(--accent); }
.h4 { margin: 0; font-size: 18px; font-weight: 700; }

.ctaBand {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 24px; padding: 40px;
  border-radius: 24px; border: 1px solid var(--line);
  background: radial-gradient(ellipse 60% 120% at 0% 50%, #2A2238 0%, var(--panel) 60%);
}
.ctaBandTitle { margin: 0; font-size: 32px; }

.footer { margin-top: auto; padding: 24px 32px; border-top: 1px solid var(--line-soft); }
.footerInner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--muted); }
.footerBrand { font-size: 12px; color: var(--text); }
.footerLink { color: var(--muted); }
```

- [ ] **Step 4: 新建五个首页组件**

`components/landing/SiteNav.tsx`：

```tsx
import Link from 'next/link'
import styles from './landing.module.css'

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL

export default function SiteNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={`font-mark ${styles.brand}`}>AVATAR DRESSUP</Link>
      <nav className={styles.navLinks} aria-label="主导航">
        <a href="#steps" className="btn-ghost">怎么做</a>
        {REPO_URL && (
          <a href={REPO_URL} className="btn-ghost" target="_blank" rel="noreferrer">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-4.5 1.5-4.5-2.5-6-3M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.5 2.8 5.5 3.1 5.5 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
            </svg>
            GitHub
          </a>
        )}
        <Link href="/create" className="btn-primary">开始创建</Link>
      </nav>
    </header>
  )
}
```

`components/landing/Hero.tsx`：

```tsx
import Link from 'next/link'
import styles from './landing.module.css'

const POSTERS = [
  { cls: styles.posterA, src: '/landing/poster-fantasy.webp', label: '奇幻插画' },
  { cls: styles.posterB, src: '/landing/poster-anime.webp', label: '动漫' },
  { cls: styles.posterC, src: '/landing/poster-cyberpunk.webp', label: '赛博朋克' },
]

export default function Hero() {
  return (
    <section className={styles.hero} aria-label="首屏">
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <span className={`font-mark ${styles.eyebrow}`}>THREE.JS × AI POSTER</span>
          <h1 className={`font-display ${styles.title}`}>创建你的 3D 形象<br />换装，再让 AI 画成海报</h1>
          <p className={styles.lead}>在浏览器里实时换装：七个部位、两套服装、两个底模。满意了就一键截图，交给 AI 渲染成一张可下载的海报。</p>
          <div className={styles.ctaRow}>
            <Link href="/create" className={`btn-primary ${styles.ctaLarge}`}>
              开始创建
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <a href="#steps" className={`btn-ghost ${styles.ctaLarge}`}>看看三步怎么做</a>
          </div>
          <div className={styles.facts}>
            <span className={styles.fact}>无需安装，打开即用</span>
            <span className={styles.fact}>素材 CC0，可商用</span>
          </div>
        </div>
        <div className={styles.art} role="img" aria-label="三张 AI 海报示意">
          {POSTERS.map((p) => (
            <div key={p.src} className={`${styles.poster} ${p.cls}`}>
              <img src={p.src} width={220} height={330} alt="" />
              <span className={styles.badge}>AI 海报</span>
              <span className={`font-display ${styles.posterLabel}`}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

`components/landing/Features.tsx`：

```tsx
import styles from './landing.module.css'

const ICON = {
  shirt: 'M8 4l4 2 4-2 4 3-2 4-2-1v11H8V10l-2 1-2-4z',
  camera: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  sparkles: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
}

const FEATURES = [
  { icon: ICON.shirt, ai: false, title: '实时换装', text: '七个部位，两套完整服装，两个底模。装上一件自动补齐整套，之后随意混搭。所有部件共用一副骨骼，怎么换都不会错位。' },
  { icon: ICON.camera, ai: false, title: '动画与视角', text: '角色一直在待机动画里呼吸，衣服跟着动。镜头可以聚焦头部看发型，也可以拉远看全身，随时一键截图。' },
  { icon: ICON.sparkles, ai: true, title: 'AI 海报', text: '奇幻插画、动漫、水彩、赛博朋克四种风格。把当前形象交给 AI，几十秒后得到一张海报，直接下载。' },
]

export default function Features() {
  return (
    <section className={styles.section} aria-label="能力">
      <div className={`${styles.container} ${styles.sectionInner}`}>
        <div className={styles.sectionHead}>
          <span className={`font-mark ${styles.eyebrow}`}>WHAT YOU GET</span>
          <h2 className={`font-display ${styles.h2}`}>三件事，一个页面做完</h2>
        </div>
        <div className={styles.cards}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <span className={`${styles.icon} ${f.ai ? styles.iconAi : ''}`}>
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
              </span>
              <h3 className={styles.h3}>{f.title}</h3>
              <p className={styles.p}>{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
```

`components/landing/Steps.tsx`：

```tsx
import Link from 'next/link'
import styles from './landing.module.css'

const STEPS = [
  { no: '01', title: '选底模', text: '男性或女性，性别不匹配的衣服会自动过滤。' },
  { no: '02', title: '换衣服', text: '点一件套装一键穿上，再按部位逐件调整，发型、眉毛、配饰都在同一个面板。' },
  { no: '03', title: '生成海报', text: '选一种风格，等 AI 画完，下载到本地。' },
]

export default function Steps() {
  return (
    <>
      <section id="steps" className={styles.section} aria-label="三步流程">
        <div className={`${styles.container} ${styles.sectionInner}`}>
          <div className={styles.sectionHead}>
            <span className={`font-mark ${styles.eyebrow}`}>HOW IT WORKS</span>
            <h2 className={`font-display ${styles.h2}`}>三步，从底模到海报</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.no} className={styles.step}>
                <span className={`font-mark ${styles.stepNo}`}>{s.no}</span>
                <h3 className={styles.h4}>{s.title}</h3>
                <p className={styles.p}>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className={styles.section} aria-label="开始创建" style={{ paddingTop: 0 }}>
        <div className={`${styles.container} ${styles.ctaBand}`}>
          <div className={styles.sectionHead}>
            <h2 className={`font-display ${styles.ctaBandTitle}`}>现在就开始</h2>
            <p className={styles.p}>不用注册，不用安装，打开就是你的换装台。</p>
          </div>
          <Link href="/create" className={`btn-primary ${styles.ctaLarge}`}>开始创建</Link>
        </div>
      </section>
    </>
  )
}
```

`components/landing/SiteFooter.tsx`：

```tsx
import styles from './landing.module.css'

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <span className={`font-mark ${styles.footerBrand}`}>AVATAR DRESSUP</span>
        <span>素材来自 Quaternius，CC0 许可 · three.js 渲染 · {new Date().getFullYear()}</span>
        {REPO_URL ? <a href={REPO_URL} className={styles.footerLink} target="_blank" rel="noreferrer">GitHub</a> : <span />}
      </div>
    </footer>
  )
}
```

- [ ] **Step 5: 重写 app/page.tsx**

```tsx
import Features from '../components/landing/Features'
import Hero from '../components/landing/Hero'
import SiteFooter from '../components/landing/SiteFooter'
import SiteNav from '../components/landing/SiteNav'
import Steps from '../components/landing/Steps'
import styles from '../components/landing/landing.module.css'

export default function HomePage() {
  return (
    <div className={styles.page}>
      <SiteNav />
      <main>
        <Hero />
        <Features />
        <Steps />
      </main>
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 6: 重建字体、构建、验证**

Run: `npm run fonts:build && npm run typecheck && npm run build`
Expected: 构建输出里 `/` 标为静态（○）。

Run: `npm run dev`，打开 `http://localhost:3000`：

- 顶栏、首屏三张海报在浮动、三张能力卡、三步、结尾入口、页脚，结构与画板「首页介绍页」一致。
- 开发者工具 Network：没有任何 `.glb` 请求，也没有 three 的 chunk；首屏总传输小于 1 MB。
- 把窗口缩到 400 像素宽，没有横向滚动，海报区堆到文字下方。
- 点「开始创建」进入 `/create`；换装页字标点回首页。
- 系统开启「减弱动态效果」后海报不浮动。

- [ ] **Step 7: 提交**

```bash
git add components/landing app/page.tsx scripts/landing-webp.mjs public/landing package.json .gitignore app/fonts
git commit -m "feat: 首页介绍页

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 容器化、云托管部署、README

**Files:**
- Create: `Dockerfile`、`.dockerignore`、`.npmrc`
- Rewrite: `README.md`

**Interfaces:**
- Consumes: 前面所有任务。
- Produces: 可构建的镜像；云托管上运行的服务；README 里的运行与部署说明。

- [ ] **Step 1: 新建 .npmrc 与 .dockerignore**

`.npmrc`：

```
registry=https://registry.npmmirror.com
```

`.dockerignore`：

```
node_modules
.next
.git
assets-src
public/landing/src
docs
tests
*.zip
*.pdf
.env*.local
```

- [ ] **Step 2: 新建 Dockerfile**

```dockerfile
# ===== Stage 1: deps =====
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ===== Stage 2: builder =====
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* 在 build 时就要有值，改了必须重新构建
ARG NEXT_PUBLIC_ASSET_BASE=/avatar/
ARG NEXT_PUBLIC_REPO_URL=
ENV NEXT_PUBLIC_ASSET_BASE=$NEXT_PUBLIC_ASSET_BASE
ENV NEXT_PUBLIC_REPO_URL=$NEXT_PUBLIC_REPO_URL
RUN npm run build

# ===== Stage 3: runner =====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# sharp 渲染海报标题栏的 SVG 文字需要系统字体
RUN apk add --no-cache fontconfig ttf-dejavu \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: 本地构建镜像并跑通**

本机有 Docker Desktop 时：

```bash
docker build -t avatar-dressup:local .
docker run --rm -p 3000:3000 -e POSTER_PROVIDER=mock avatar-dressup:local
```

打开 `http://localhost:3000`，首页正常；`/create` 能换装；生成一张海报，底部标题栏的英文和日期能显示（字体装对了）。镜像体积用 `docker images avatar-dressup:local` 看，预期 300 到 400 MB。

本机没有 Docker 时跳过这步，直接云端构建，构建失败看「部署历史 → 查看日志」。

- [ ] **Step 4: 重写 README.md**

```markdown
# avatar-dressup

基于 three.js 的 3D 虚拟人换装，加一个走服务端适配器的「AI 海报」。Next.js 16 加 React 19，部署在腾讯云云托管。

- 首页 `/`：介绍页。
- 换装页 `/create`：七个部位换装、一键套装、底模切换、待机动画、截图、生成海报。
- 海报接口 `POST /api/poster`：当前只有假适配器（sharp 做风格化），真实 AI 服务以后接。

## 本地运行

```bash
npm install
cp .env.example .env.local      # POSTER_PROVIDER=mock
npm run dev                     # http://localhost:3000
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建，standalone 输出 |
| `npm start` | 跑生产构建 |
| `npm run typecheck` | tsc 类型检查 |
| `npm test` | vitest 单元测试 |
| `npm run assets:scan` / `assets:build` | 从 assets-src 生成模型与 manifest，见 docs/ASSETS.md |
| `npm run fonts:build` | 按源码字符子集化两款自托管字体 |
| `npm run landing:webp` | 首页海报素材转 webp |

## 环境变量

| 变量 | 何时生效 | 说明 |
|---|---|---|
| `POSTER_PROVIDER` | 运行时 | 海报适配器，当前只有 `mock`；未设置或拼错时接口返回 500 |
| `NEXT_PUBLIC_ASSET_BASE` | 构建时 | 模型贴图的基址，默认同源 `/avatar/` |
| `NEXT_PUBLIC_REPO_URL` | 构建时 | 首页 GitHub 按钮，留空不显示 |

## 部署到腾讯云云托管

```bash
npm i -g @cloudbase/cli
tcb login
tcb cloudrun deploy --port 3000
```

部署后在控制台「云托管 → 服务 → 服务设置」里：环境变量加 `POSTER_PROVIDER=mock`；规格 0.25 核 0.5 GB；副本模式高可用，最小 1 最大 2。云端构建用仓库里的 Dockerfile。

## 文档

- 设计：`docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-10-nextjs-cloudbase-poster.md`
- 3D 换装核心设计：`docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md`
- 素材：`docs/ASSETS.md`

## 素材与许可

模型来自 Quaternius 的 Universal Base Characters、Modular Character Outfits - Fantasy、Universal Animation Library，CC0。字体 Orbitron 与站酷庆科黄油体，OFL。
```

- [ ] **Step 5: 提交容器文件与 README**

```bash
git add Dockerfile .dockerignore .npmrc README.md
git commit -m "build: Dockerfile、npm 镜像与部署说明

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: 部署到云托管**

前提：用户已购买云开发个人版并创建了环境。

```bash
npm i -g @cloudbase/cli
tcb login
tcb cloudrun deploy --port 3000
```

CLI 提问时：选该环境 ID；服务名填 `avatar-dressup`；公网访问选是。等云端构建完成（几分钟）。

然后进控制台「云托管 → 服务 → avatar-dressup → 服务设置」：

1. 环境变量加 `POSTER_PROVIDER=mock`，新建版本并把流量切过去。
2. CPU 与内存改为 0.25 核 0.5 GB。
3. 副本模式选高可用，最小副本 1，最大 2。

- [ ] **Step 7: 线上验收 M3 与 M4**

把 `<域名>` 换成控制台显示的默认域名：

```bash
curl -I https://<域名>/
curl -I https://<域名>/create
curl -I https://<域名>/avatar/manifest.json
curl -I https://<域名>/_next/static/chunks/main-app.js
```

四个都应是 200（最后一个文件名以构建输出为准，开发者工具 Network 里看任一 `/_next/static/chunks/*.js` 是 200 即可）。

浏览器里：

- M4：打开首页，Network 没有 `.glb`；点「开始创建」进入换装页。
- M3：换装后生成海报并下载成功，底部标题栏文字可见。
- 控制台「云开发 → 套餐用量」记下今天的资源点消耗，第二天再看一次，日均应在 700 到 1500 点之间（常驻实例）。

- [ ] **Step 8: 记录穿模结论并收尾**

把 M1 观察到的穿模情况和线上域名写进 `docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md` 第 12 节末尾，一两句即可，然后提交：

```bash
git add docs
git commit -m "docs: 记录 M1 穿模观察与线上域名

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
