import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
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

/** 用 canvas 画一张径向渐变灰度图，给地台和接触阴影当 alphaMap */
function radialAlphaTexture(size: number, stops: Array<[number, string]>): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    for (const [offset, color] of stops) g.addColorStop(offset, color)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(c)
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
  /** 截图时临时填回的底色；平时 canvas 透明，让视口 CSS 的辉光透出来 */
  private readonly background: THREE.Color
  private readonly disposables: Array<{ dispose(): void }> = []

  /** 卸载后置位：在途加载回来时不再推相机、不再回调 */
  private disposed = false
  private focusT = 1
  private readonly targetFrom = new THREE.Vector3()
  private readonly targetTo = new THREE.Vector3()
  private readonly camFrom = new THREE.Vector3()
  private readonly camTo = new THREE.Vector3()

  constructor(
    private readonly container: HTMLElement,
    resolveUrl: (p: string) => string,
    options: { background: string },
  ) {
    this.background = new THREE.Color(options.background)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100)
    this.camera.position.set(0, 2.0, 3.0)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.minDistance = 1.2
    this.controls.maxDistance = 5
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05
    this.controls.target.set(0, 1, 0)

    // 环境贴图只负责反射，强度压低，让三盏灯主导明暗
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.45
    pmrem.dispose()
    this.scene.background = null

    this.buildLights()
    this.buildStage()

    this.rig = new AvatarRig(this.loader, resolveUrl)
    this.scene.add(this.rig.root)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.loop()
  }

  /** 三点光：暖主光斜打、冷轮廓光从后勾边、顶部聚光打出脚下光池；半球光填暗部 */
  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xcfd6ff, 0x2a2238, 0.35)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffe9cf, 2.4)
    key.position.set(-2.2, 4.2, 2.6)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 12
    key.shadow.camera.left = -1.6
    key.shadow.camera.right = 1.6
    key.shadow.camera.top = 2.6
    key.shadow.camera.bottom = -0.6
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.02
    key.shadow.radius = 4
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x8fa3ff, 1.6)
    rim.position.set(2.4, 3.0, -2.6)
    this.scene.add(rim)

    const top = new THREE.SpotLight(0xfff4e6, 28, 9, Math.PI / 7, 0.65, 1.2)
    top.position.set(0, 5.2, 0.15)
    top.target.position.set(0, 0, 0)
    top.castShadow = true
    top.shadow.mapSize.set(1024, 1024)
    top.shadow.bias = -0.0004
    top.shadow.normalBias = 0.02
    this.scene.add(top)
    this.scene.add(top.target)
  }

  /** 磨砂暗色圆台，边缘渐隐进背景；外圈一道细金描边；脚下一片接触阴影 */
  private buildStage(): void {
    const floorAlpha = radialAlphaTexture(512, [
      [0, '#ffffff'],
      [0.55, '#ffffff'],
      [0.85, '#555555'],
      [1, '#000000'],
    ])
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1b1824,
      roughness: 0.55,
      metalness: 0.25,
      envMapIntensity: 0.6,
      transparent: true,
      alphaMap: floorAlpha,
    })
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 96), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)
    this.disposables.push(floorAlpha, floorMat, floor.geometry)

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe8a445, transparent: true, opacity: 0.45, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.17, 1.21, 160), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.002
    this.scene.add(ring)
    this.disposables.push(ringMat, ring.geometry)

    const contactAlpha = radialAlphaTexture(256, [
      [0, '#ffffff'],
      [0.35, '#999999'],
      [0.7, '#333333'],
      [1, '#000000'],
    ])
    const contactMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.75,
      alphaMap: contactAlpha,
      depthWrite: false,
    })
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.72, 64), contactMat)
    contact.rotation.x = -Math.PI / 2
    contact.position.y = 0.004
    contact.renderOrder = 1
    this.scene.add(contact)
    this.disposables.push(contactAlpha, contactMat, contact.geometry)
  }

  on<K extends keyof ViewerEvents>(event: K, fn: ViewerEvents[K]): void {
    this.listeners[event] = fn
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
    // 全身机位：相机抬到目标上方约 18 度轻微俯视，比正平视更有体积感。
    // 1.8 倍身高 + 2.6m 下限：1.9m 的人物连脚带头顶完整入画还留呼吸空间
    const dist = Math.max(size.y * 1.8, 2.6)
    const elevation = THREE.MathUtils.degToRad(18)
    this.startFocus(
      center,
      new THREE.Vector3(center.x, center.y + dist * Math.sin(elevation), center.z + dist * Math.cos(elevation)),
    )
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
    if (this.disposed) return
    this.listeners.loading?.('start', base.id)
    try {
      await this.rig.setBase(base)
      if (this.disposed) return
      this.focus('body')
    } catch (e) {
      this.listeners.error?.(base.id, reasonOf(e))
      throw e
    } finally {
      this.listeners.loading?.('end', base.id)
    }
  }

  async equip(part: Part): Promise<void> {
    if (this.disposed) return
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

  /** body 槽穿上真服装时隐藏底模自带衣物纹样的躯干（见 AvatarRig.setBaseBodyHidden） */
  setBaseBodyHidden(hidden: boolean): void {
    this.rig.setBaseBodyHidden(hidden)
  }

  async playAnimation(anim: AnimationRef): Promise<void> {
    if (this.disposed) return
    try {
      await this.rig.playAnimation(anim)
    } catch (e) {
      this.listeners.error?.(anim.id, reasonOf(e))
      throw e
    }
  }

  /** 固定尺寸渲染一帧并导出 JPEG；截图时填回底色，透明 canvas 不会变成黑底 */
  screenshot(width = 768, height = 1152, quality = 0.85): string {
    const size = this.renderer.getSize(new THREE.Vector2())
    const pixelRatio = this.renderer.getPixelRatio()
    const aspect = this.camera.aspect
    try {
      this.scene.background = this.background
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderer.render(this.scene, this.camera)
      return this.renderer.domElement.toDataURL('image/jpeg', quality)
    } finally {
      this.scene.background = null
      this.renderer.setPixelRatio(pixelRatio)
      this.renderer.setSize(size.x, size.y, false)
      this.camera.aspect = aspect
      this.camera.updateProjectionMatrix()
    }
  }

  dispose(): void {
    this.disposed = true
    // 摘掉监听：卸载后 rig 里在途的加载还会回来，不该再写已卸载组件的状态
    this.listeners.loading = undefined
    this.listeners.error = undefined
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
