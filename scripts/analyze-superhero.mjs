// 分析 Superhero_Male_FullBody 身体网格的连通分量：衣服若是独立壳，就能按分量拆分
import fs from 'node:fs'

const dir = 'assets-src/base/Universal Base Characters[Standard]/Base Characters/Godot - UE'
const gltf = JSON.parse(fs.readFileSync(`${dir}/Superhero_Male_FullBody.gltf`, 'utf8'))

// 找身体 mesh（Sphere.005_Retopology.004）
const meshIdx = gltf.meshes.findIndex((m) => m.name.includes('Sphere'))
const prim = gltf.meshes[meshIdx].primitives[0]
const posAcc = gltf.accessors[prim.attributes.POSITION]
const idxAcc = gltf.accessors[prim.indices]

function readAcc(accIdx) {
  const acc = gltf.accessors[accIdx]
  const bv = gltf.bufferViews[acc.bufferView]
  const buf = gltf.buffers[bv.buffer]
  const bin = fs.readFileSync(`${dir}/${buf.uri}`)
  const offset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const comp = acc.componentType === 5126 ? Float32Array : Uint16Array
  const size = { VEC3: 3, SCALAR: 1 }[acc.type]
  const out = []
  for (let i = 0; i < acc.count; i++) {
    const o = offset + i * size * comp.BYTES_PER_ELEMENT
    if (size === 3) out.push([comp === Float32Array ? bin.readFloatLE(o) : bin.readUInt16LE(o), comp === Float32Array ? bin.readFloatLE(o + 4) : bin.readUInt16LE(o + 4), comp === Float32Array ? bin.readFloatLE(o + 8) : bin.readUInt16LE(o + 8)])
    else out.push(comp === Float32Array ? bin.readFloatLE(o) : bin.readUInt16LE(o))
  }
  return out
}

const pos = readAcc(prim.attributes.POSITION)
const idx = readAcc(prim.indices)
console.log(`顶点 ${pos.length}，索引 ${idx.length}`)

// 并查集求连通分量（按边）
const parent = new Int32Array(pos.length)
for (let i = 0; i < pos.length; i++) parent[i] = i
function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
for (let i = 0; i < idx.length; i += 3) {
  union(idx[i], idx[i + 1]); union(idx[i], idx[i + 2]); union(idx[i + 1], idx[i + 2])
}

const compMap = new Map()
for (let i = 0; i < pos.length; i++) {
  const r = find(i)
  if (!compMap.has(r)) compMap.set(r, [])
  compMap.get(r).push(i)
}

console.log(`\n连通分量数：${compMap.size}`)
for (const [root, verts] of compMap) {
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9
  for (const vi of verts) {
    const [x, y, z] = pos[vi]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  console.log(`分量 ${verts.length} 顶点 | x[${minX.toFixed(3)},${maxX.toFixed(3)}] y[${minY.toFixed(3)},${maxY.toFixed(3)}] z[${minZ.toFixed(3)},${maxZ.toFixed(3)}]`)
}
