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
