import {
  AnimationClip, AnimationMixer, type Bone, Box3, Group, LoopRepeat, type Material,
  type Mesh, type Object3D, type Skeleton, type SkinnedMesh, Vector3,
} from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
import type { GltfSource, LoadedGltf } from './PartLoader'
import { retargetClipToJustCreate } from './retarget'
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
  /** 当前底模的骨架体系，决定动画是否需要重定向 */
  private rig: 'quaternius' | 'justcreate' = 'quaternius'

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
    this.rig = base.rig ?? 'quaternius'
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
    // 动画是 Quaternius 命名；JustCreate 底模需要烘焙式 delta 重定向
    // （需源动画骨架 rest 与目标底模骨架 rest，才能抵消两套 rest 朝向差异，避免倒立）
    const finalClip =
      this.rig === 'justcreate' && this.baseScene
        ? retargetClipToJustCreate(clip, gltf.scene, this.baseScene)
        : clip
    const action = mixer.clipAction(finalClip)
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
    // 测量前必须刷新整棵子树的世界矩阵：focus 常在部件刚 add、渲染循环尚未
    // 跑帧的微任务里调用，此时父链 matrixWorld 是陈旧值（部件 glb 自带 ×100
    // 节点缩放未被父级 ×0.01 抵消），会把模型量成 100 倍大——相机直接飞上天。
    this.root.updateMatrixWorld(true)
    if (this.baseScene) target.setFromObject(this.baseScene, true)
    // 已装备部件也计入：拆分式底模（JustCreate）裸态只有躯干，若只量底模，
    // 相机会按"躯干"取景——全身机位凑太近、腿脚全被裁掉
    for (const entry of this.equipped.values()) {
      for (const mesh of entry.meshes) target.expandByObject(mesh, true)
    }
    return target
  }

  getHeadWorldPosition(target = new Vector3()): Vector3 | null {
    const head =
      this.boneByName.get('head') ?? [...this.boneByName.values()].find((b) => /head/i.test(b.name))
    return head ? head.getWorldPosition(target) : null
  }
}
