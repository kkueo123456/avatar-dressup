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
