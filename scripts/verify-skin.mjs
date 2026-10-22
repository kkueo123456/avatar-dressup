/* 蒙皮验证（three 完整链路）：输出蒙皮后顶点世界包围盒 */
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis
if (typeof globalThis.Blob === 'undefined') {
  const { Blob } = await import('node:buffer')
  globalThis.Blob = Blob
}
if (typeof globalThis.createImageBitmap === 'undefined') {
  const sharp = (await import('sharp')).default
  globalThis.createImageBitmap = async (blob) => {
    const buf = Buffer.from(await blob.arrayBuffer())
    const meta = await sharp(buf).metadata()
    return { image: buf, width: meta.width, height: meta.height, close() {} }
  }
}
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Box3, Vector3 } from 'three'
import { readFile } from 'node:fs/promises'

const loader = new GLTFLoader()
for (const file of process.argv.slice(2)) {
  const buf = await readFile(file)
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej))
  const scene = SkeletonUtils.clone(gltf.scene)
  scene.updateMatrixWorld(true)
  const box = new Box3()
  const v = new Vector3()
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return
    const pos = o.geometry.attributes.position
    const stride = Math.max(1, Math.floor(pos.count / 400))
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i)
      o.applyBoneTransform(i, v)
      v.applyMatrix4(o.matrixWorld)
      box.expandByPoint(v)
    }
  })
  if (box.isEmpty()) { console.log(`${file}: 无蒙皮网格!`); continue }
  const s = box.getSize(new Vector3())
  const ok = s.y > 1.2 && Math.abs(box.min.y) < 0.3
  console.log(`${file}: 高 ${s.y.toFixed(2)}m, y ${box.min.y.toFixed(2)}~${box.max.y.toFixed(2)} ${ok ? '✓' : '✗✗✗'}`)
}
