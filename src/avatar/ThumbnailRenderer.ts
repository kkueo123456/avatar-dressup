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
  private disposed = false

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
    // 已释放就别再排队了；调用方（PartCard）会 catch 掉
    if (this.disposed) return Promise.reject(new Error('缩略图渲染器已释放'))
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
    // dispose 之后队列里还在等的那几个任务在这里短路，不会再建一个 WebGL 上下文出来
    if (this.disposed) throw new Error('缩略图渲染器已释放')
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
    this.disposed = true
    this.renderer?.dispose()
    this.renderer = null
    this.memory.clear()
  }
}
