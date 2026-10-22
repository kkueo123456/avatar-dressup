/* 单 mesh 精确验证：只算 SM_Male_Base_Body 一个 mesh 的蒙皮包围盒（避免其他 mesh 干扰联合包围盒） */
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

const TARGET = process.argv[3] ?? 'SM_Male_Base_Body'
const loader = new GLTFLoader()
for (const file of process.argv[2] === '--mesh' ? process.argv.slice(4) : process.argv.slice(2)) {
  const buf = await readFile(file)
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej))
  const scene = SkeletonUtils.clone(gltf.scene)
  scene.updateMatrixWorld(true)
  const box = new Box3()
  const v = new Vector3()
  let found = false
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o.name.replace(/_\d+$/, '') !== TARGET) return
    found = true
    const pos = o.geometry.attributes.position
    const stride = Math.max(1, Math.floor(pos.count / 400))
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i)
      o.applyBoneTransform(i, v)
      v.applyMatrix4(o.matrixWorld)
      box.expandByPoint(v)
    }
  })
  if (!found) { console.log(`${file}: 未找到目标 mesh ${TARGET}!`); continue }
  const s = box.getSize(new Vector3())
  const ok = s.y > 1.2 && Math.abs(box.min.y) < 0.3
  console.log(`${file} [${TARGET}]: 高 ${s.y.toFixed(2)}m, y ${box.min.y.toFixed(2)}~${box.max.y.toFixed(2)} ${ok ? '✓' : '✗✗✗'}`)
}
