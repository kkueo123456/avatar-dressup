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
