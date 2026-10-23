import type { AnimationClip, Material, Object3D } from 'three'
import type { MeshStandardMaterial } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

export interface LoadedGltf {
  scene: Object3D
  animations: AnimationClip[]
}

export interface GltfSource {
  load(url: string): Promise<LoadedGltf>
}

/**
 * 校正 Quaternius 资产出厂自带的"油感"PBR 参数。
 * 全系模型出厂为 metalness=0.4 / roughness=0.27（塑料光泽），
 * 布料/皮肤用这个值会泛强高光发油；按材质名分类拉回写实量级：
 * 皮肤哑光、头发柔亮、眼睛湿润、其余（布料/皮革/护甲）高粗糙近零金属。
 * 在加载缓存层统一做一次，底模/部件/缩略图三处渲染一致生效。
 */
function sanitizeAvatarMaterial(mat: Material): void {
  const std = mat as MeshStandardMaterial
  if (typeof std.roughness !== 'number' || typeof std.metalness !== 'number') return
  const name = mat.name.toLowerCase()
  if (name.includes('eye')) {
    // 眼睛保持湿润感，只压金属
    std.metalness = 0
    std.roughness = Math.max(std.roughness, 0.3)
  } else if (name.includes('hair')) {
    // 头发：低光泽柔亮（太哑光会像毛毡）
    std.metalness = 0
    std.roughness = Math.max(std.roughness, 0.45)
  } else if (name.includes('skin')) {
    // 皮肤：哑光，完全去金属
    std.metalness = 0
    std.roughness = Math.max(std.roughness, 0.55)
  } else {
    // 布料/皮革/护甲：高粗糙、近零金属（金属光泽留给真正的金属件贴图去表现）
    std.metalness = Math.min(std.metalness, 0.05)
    std.roughness = Math.max(std.roughness, 0.75)
  }
  if (typeof std.envMapIntensity === 'number') std.envMapIntensity = Math.min(std.envMapIntensity, 0.4)
  std.needsUpdate = true
}

function sanitizeGltfMaterials(gltf: GLTF): void {
  gltf.scene.traverse((obj) => {
    const mesh = obj as { isMesh?: boolean; material?: Material | Material[] }
    if (!mesh.isMesh || !mesh.material) return
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      sanitizeAvatarMaterial(mat)
    }
  })
}

/** GLTFLoader 封装：同一 URL 只请求一次，失败后允许重试 */
export class PartLoader implements GltfSource {
  private readonly cache = new Map<string, Promise<GLTF>>()
  private readonly loader = new GLTFLoader()

  load(url: string): Promise<GLTF> {
    let p = this.cache.get(url)
    if (!p) {
      p = this.loader
        .loadAsync(url)
        .then((gltf) => {
          sanitizeGltfMaterials(gltf)
          return gltf
        })
        .catch((err: unknown) => {
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
