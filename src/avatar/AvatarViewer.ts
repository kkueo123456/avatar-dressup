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
    const pixelRatio = this.renderer.getPixelRatio()
    const aspect = this.camera.aspect
    try {
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/jpeg', quality)
    } finally {
      this.renderer.setPixelRatio(pixelRatio)
      this.renderer.setSize(size.x, size.y, false)
      this.camera.aspect = aspect
      this.camera.updateProjectionMatrix()
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
