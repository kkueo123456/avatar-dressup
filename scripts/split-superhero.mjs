// 把老模型（superhero fullbody）glb 的身体网格按连通分量拆成 头/身体 两个 mesh。
// 头部（含脖子）在穿真服装时保留显示，身体（含烘焙的初始衣物）可被整体隐藏。
// 用法：node scripts/split-superhero.mjs <glb路径> [头部分量的重心y阈值，默认1.55]
import fs from 'node:fs'

const [, , glbPath] = process.argv
if (!glbPath) {
  console.error('用法: node scripts/split-superhero.mjs <glb路径>')
  process.exit(1)
}

// ── 读 GLB ──
const buf = fs.readFileSync(glbPath)
const jsonLen = buf.readUInt32LE(12)
const binStart = 20 + jsonLen + 8 // JSON chunk 之后还有 8 字节 BIN chunk 头（length+type），数据从 +8 开始
const binLen = buf.readUInt32LE(20 + jsonLen)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
const bin = buf.slice(binStart, binStart + binLen)

// ── 定位身体 mesh 与它的 node（选顶点数最多的 skinned mesh）──
function vertCount(m) {
  const acc = json.accessors[m.primitives[0].attributes.POSITION]
  return acc.count
}
const skinned = json.meshes
  .map((m, i) => ({ i, m, n: vertCount(m) }))
  .filter((e) => json.nodes.some((n) => n.mesh === e.i && n.skin !== undefined))
skinned.sort((a, b) => b.n - a.n)
const bodyMeshIdx = skinned[0].i
if (bodyMeshIdx === undefined) throw new Error('找不到 skinned mesh')
const bodyMesh = json.meshes[bodyMeshIdx]
const bodyNodeIdx = json.nodes.findIndex((n) => n.mesh === bodyMeshIdx)
const bodyNode = json.nodes[bodyNodeIdx]
console.log(`身体 mesh #${bodyMeshIdx} "${bodyMesh.name}"（${skinned[0].n} 顶点），node #${bodyNodeIdx} "${bodyNode.name}"，skin=${bodyNode.skin}`)

const prim = bodyMesh.primitives[0]
const posAccIdx = prim.attributes.POSITION
const idxAccIdx = prim.indices
const posAcc = json.accessors[posAccIdx]
const idxAcc = json.accessors[idxAccIdx]

function readVec3(accIdx) {
  const acc = json.accessors[accIdx]
  const bv = json.bufferViews[acc.bufferView]
  const bvStart = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const stride = bv.byteStride ?? 12
  // 交错布局时 POSITION 可能不在块首：用 accessor 自带的 min/max 自动探测块内偏移
  let inner = 0
  if (bv.byteStride && bv.byteStride !== 12 && acc.min && acc.max) {
    for (let o = 0; o < stride; o += 4) {
      let ok = true
      for (let k = 0; k < 3 && ok; k++) {
        let mn = Infinity, mx = -Infinity
        for (let i = 0; i < acc.count; i += Math.max(1, Math.floor(acc.count / 500))) {
          const v = bin.readFloatLE(bvStart + i * stride + o + k * 4)
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
        if (mn < acc.min[k] - 0.01 || mx > acc.max[k] + 0.01) ok = false
      }
      if (ok) { inner = o; break }
    }
  }
  const out = new Float32Array(acc.count * 3)
  for (let i = 0; i < acc.count; i++) {
    const o = bvStart + i * stride + inner
    out[i * 3] = bin.readFloatLE(o)
    out[i * 3 + 1] = bin.readFloatLE(o + 4)
    out[i * 3 + 2] = bin.readFloatLE(o + 8)
  }
  return out
}
function readIndices(accIdx) {
  const acc = json.accessors[accIdx]
  const bv = json.bufferViews[acc.bufferView]
  const off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const u32 = acc.componentType === 5125
  const out = new Uint32Array(acc.count)
  for (let i = 0; i < acc.count; i++) out[i] = u32 ? bin.readUInt32LE(off + i * 4) : bin.readUInt16LE(off + i * 2)
  return out
}

const pos = readVec3(posAccIdx)
const idx = readIndices(idxAccIdx)

// ── 连通分量 ──
const parent = new Int32Array(posAcc.count)
for (let i = 0; i < posAcc.count; i++) parent[i] = i
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
for (let i = 0; i < idx.length; i += 3) {
  union(idx[i], idx[i + 1]); union(idx[i], idx[i + 2]); union(idx[i + 1], idx[i + 2])
}
// glTF 规范 Y-up，身高轴固定为 y
const upAxis = 1
let upMin = Infinity, upMax = -Infinity
for (let i = 0; i < posAcc.count; i++) {
  const v = pos[i * 3 + upAxis]
  if (v < upMin) upMin = v
  if (v > upMax) upMax = v
}
const headThreshold = upMin + (upMax - upMin) * 0.85
console.log(`y 值域 [${upMin.toFixed(3)}, ${upMax.toFixed(3)}]，头部分量阈值 = ${headThreshold.toFixed(3)}`)

const compUp = new Map() // root -> {sum, count}
for (let i = 0; i < posAcc.count; i++) {
  const r = find(i)
  const e = compUp.get(r) ?? { sum: 0, count: 0 }
  e.sum += pos[i * 3 + upAxis]; e.count++
  compUp.set(r, e)
}

// ── 按三角形归类（三角形顶点所在分量为 head 则归 head）──
const headTris = []
const bodyTris = []
for (let i = 0; i < idx.length; i += 3) {
  const r = find(idx[i])
  const { sum, count } = compUp.get(r)
  const isHead = sum / count > headThreshold
  ;(isHead ? headTris : bodyTris).push(idx[i], idx[i + 1], idx[i + 2])
}
console.log(`head 三角形 ${headTris.length / 3}，body 三角形 ${bodyTris.length / 3}`)

// ── 追加 indices 的 bufferView + accessor ──
function appendIndices(arr, componentType) {
  const byteOffset = bin.length + accumPad
  const data = componentType === 5125 ? Buffer.from(new Uint32Array(arr).buffer) : Buffer.from(new Uint16Array(arr).buffer)
  const pad = (4 - (byteOffset % 4)) % 4
  chunks.push(Buffer.alloc(pad), data)
  accumPad += pad + data.length
  json.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length })
  json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType, count: arr.length, type: 'SCALAR' })
  return json.accessors.length - 1
}
const chunks = []
let accumPad = 0
const headIdxAcc = appendIndices(headTris, idxAcc.componentType)
const bodyIdxAcc = appendIndices(bodyTris, idxAcc.componentType)

// ── 建 head mesh，node 树挂到原 node 的父级 ──
const headMesh = {
  name: 'SM_Head',
  primitives: [{ ...prim, indices: headIdxAcc }],
}
// body mesh 改名，indices 换成自己的子集
bodyMesh.name = 'SM_Body'
bodyMesh.primitives = [{ ...prim, indices: bodyIdxAcc }]
const headMeshIdx = json.meshes.length
json.meshes.push(headMesh)

const headNodeIdx = json.nodes.length
json.nodes.push({ name: 'SM_Head', mesh: headMeshIdx, skin: bodyNode.skin })

// 找原 node 的父级，把 head node 挂进去
let parentList = null
for (const n of json.nodes) if (n.children?.includes(bodyNodeIdx)) parentList = n.children
if (!parentList && json.scenes[json.scene ?? 0].nodes.includes(bodyNodeIdx)) parentList = json.scenes[json.scene ?? 0].nodes
if (!parentList) throw new Error('找不到身体 node 的父级')
parentList.push(headNodeIdx)
bodyNode.name = 'SM_Body'

// ── 更新 buffer 总长并写回 GLB ──
json.buffers[0].byteLength = bin.length + accumPad
const jsonBuf = Buffer.from(JSON.stringify(json).replace(/([\u007f-\uffff])/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')), 'utf8')
const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)
const binBuf = Buffer.concat([bin, ...chunks])
const binPad = Buffer.alloc((4 - (binBuf.length % 4)) % 4, 0)
const total = 12 + 8 + jsonBuf.length + jsonPad.length + 8 + binBuf.length + binPad.length
const out = Buffer.alloc(total)
out.writeUInt32LE(0x46546C67, 0) // glTF
out.writeUInt32LE(2, 4)
out.writeUInt32LE(total, 8)
out.writeUInt32LE(jsonBuf.length + jsonPad.length, 12)
out.writeUInt32LE(0x4E4F534A, 16) // JSON
jsonBuf.copy(out, 20); jsonPad.copy(out, 20 + jsonBuf.length)
const binChunkStart = 20 + jsonBuf.length + jsonPad.length
out.writeUInt32LE(binBuf.length + binPad.length, binChunkStart)
out.writeUInt32LE(0x004E4942, binChunkStart + 4) // BIN
binBuf.copy(out, binChunkStart + 8); binPad.copy(out, binChunkStart + 8 + binBuf.length)

fs.writeFileSync(glbPath, out)
console.log(`✅ 拆分完成，已写回 ${glbPath}（head ${headTris.length / 3} 三角 / body ${bodyTris.length / 3} 三角）`)
