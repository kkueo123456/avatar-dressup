// 把 JustCreate 的合集 FBX（已由 fbx2gltf 转成 glb）拆成独立部位 glb。
// 用法：node scripts/export-justcreate.mjs
//
// 原理：JustCreate 的 SM_Male_01.glb / SM_Female_01.glb 是"合集"，
// 内含 4 套服装×4 部位 + 多脸 + 多发型 + 配饰，全部按部位分好的独立网格，
// 各自蒙完整 62 骨骨架。本脚本把每个部位网格克隆成独立 glb（含其 skin/材质）。
//
// 贴图：FBX 的贴图引用是 Unity guid 机制，fbx2gltf 转不出来，转出的 glb 材质
// 是"裸材质"（无 baseColorTexture）。本脚本按材质名把 3 张配色 PNG 绑定回去：
//   M_texture      -> 衣服调色板 color_01（默认配色）
//   M_texture.002  -> 配饰/重甲用 color_02（对照 Unity 材质 guid）
//   M_skin/M_hair/M_eye -> Unity 材质里无贴图（_MainTex: fileID 0），是纯 _BaseColor，
//                          fbx2gltf 丢了颜色，这里按 .mat 文件值补回并移除占位贴图
//
// 输出：assets-src/justcreate/glb/ 下，每个部位一个 .glb。

import { NodeIO } from '../node_modules/.pnpm/@gltf-transform+core@4.5.1/node_modules/@gltf-transform/core/dist/index.js'
import { ALL_EXTENSIONS } from '../node_modules/.pnpm/@gltf-transform+extensions@4.5.1/node_modules/@gltf-transform/extensions/dist/index.js'
import { cloneDocument, prune } from '../node_modules/.pnpm/@gltf-transform+functions@4.5.1_@types+node@26.6.5/node_modules/@gltf-transform/functions/dist/index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'assets-src', 'justcreate', 'LP_FantasyCharacters_JC')
const OUT_DIR = path.join(ROOT, 'assets-src', 'justcreate', 'glb')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

const MALE_GLB = process.env.JC_MALE_GLB ?? path.join(SRC_DIR, 'Male_Human', 'Models', 'SM_Male_01.glb')
const FEMALE_GLB = process.env.JC_FEMALE_GLB ?? path.join(SRC_DIR, 'Female_Human', 'Models', 'SM_Female_01.glb')

// 3 张配色贴图文件
const TEXTURE_FILES = {
  color_01: 'T_FantasyCharacters_Male_01.png',
  color_02: 'T_FantasyCharacters_Male_02.png',
  color_03: 'T_FantasyCharacters_Male_03.png',
}

// 皮肤/头发/眼睛纯色（取自 LP_FantasyCharacters_*.mat 的 _BaseColor）
const SOLID_COLORS = {
  male: {
    M_skin: [0.7075472, 0.54491913, 0.4305358, 1],
    M_hair: [0.5283019, 0.36784628, 0.23673905, 1],
    M_eye: [0.4557227, 0.66394764, 0.7264151, 1],
  },
  female: {
    M_skin: [0.7830189, 0.58627754, 0.4764596, 1],
    M_hair: [0.4811321, 0.3285315, 0.20198469, 1],
    M_eye: [0.4557227, 0.66394764, 0.7264151, 1],
  },
}

function parseMeshName(name) {
  const m = name.match(/^SM_(Male|Female)_(\w+)$/)
  if (!m) return null
  const sex = m[1].toLowerCase()
  const rest = m[2]

  let f = rest.match(/^Body_Face_(\d+)$/)
  if (f) return { sex, kind: 'face', index: f[1] }
  f = rest.match(/^(?:Body_)?Hair_(\d+)$/)
  if (f) return { sex, kind: 'hair', index: f[1] }
  f = rest.match(/^Accessories_(\d+)$/)
  if (f) return { sex, kind: 'accessory', index: f[1] }
  f = rest.match(/^(Base|Light|Heavy|Wizard)_(Body|Arms|Legs|Boots)$/)
  if (f) return { sex, kind: 'part', set: f[1].toLowerCase(), piece: f[2].toLowerCase() }
  return { sex, kind: 'unknown', raw: rest }
}

// 输出 slug
function slugFor(info) {
  const sex = info.sex
  if (info.kind === 'face') return `sm_${sex}_face_${info.index}`
  if (info.kind === 'hair') return `sm_${sex}_hair_${info.index}`
  if (info.kind === 'accessory') return `sm_${sex}_acc_${info.index}`
  return `sm_${sex}_${info.set}_${info.piece}`
}

async function exportOne(srcDoc, meshName, outPath, sex) {
  // 每次从原始合集克隆，避免多 mesh 间互相污染
  const doc = cloneDocument(srcDoc)
  const root = doc.getRoot()

  // 找到目标 mesh
  const targetMesh = root.listMeshes().find((m) => m.getName() === meshName)
  if (!targetMesh) throw new Error(`找不到 mesh ${meshName}`)

  // 显式删除所有非目标 mesh（prune 不会删 Root 直接持有的 mesh 资源）
  for (const mesh of [...root.listMeshes()]) {
    if (mesh.getName() !== meshName) mesh.dispose()
  }

  // 清空场景里除目标外的所有 mesh 节点引用
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  if (scene) {
    for (const node of [...scene.listChildren()]) {
      const mm = node.getMesh()
      if (mm && mm.getName() !== meshName) node.setMesh(null)
    }
  }

  // prune 清理空节点与未引用资源
  await doc.transform(prune({ keepLeaves: false }))

  // 绑定贴图：给材质设置 baseColorTexture / 补纯色
  await bindTextures(doc, meshName, sex)

  await io.write(outPath, doc)
}

async function bindTextures(doc, meshName, sex) {
  const root = doc.getRoot()
  // 该 mesh 用到的材质
  const meshes = root.listMeshes()
  const usedMats = new Set()
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()
      if (mat) usedMats.add(mat)
    }
  }
  // 材质名 -> 调色板变体（对照 Unity 材质 LP_FantasyCharacters_Male_Color_0x 的 guid）
  const TEX_VARIANT = {
    M_texture: TEXTURE_FILES.color_01,
    'M_texture.001': TEXTURE_FILES.color_01,
    'M_texture.002': TEXTURE_FILES.color_02,
    'M_texture.003': TEXTURE_FILES.color_03,
  }
  const solids = SOLID_COLORS[sex] ?? SOLID_COLORS.male
  for (const mat of usedMats) {
    const name = mat.getName()
    if (TEX_VARIANT[name]) {
      const texP = path.join(SRC_DIR, 'Textures', TEX_VARIANT[name])
      if (fs.existsSync(texP)) {
        const tex = doc.createTexture(TEX_VARIANT[name]).setImage(fs.readFileSync(texP)).setMimeType('image/png')
        mat.setBaseColorTexture(tex)
        mat.setBaseColorFactor([1, 1, 1, 1])
      }
    } else if (solids[name]) {
      // 皮肤/头发/眼睛：纯色，移除 fbx2gltf 生成的占位贴图
      mat.setBaseColorTexture(null)
      mat.setBaseColorFactor(solids[name])
    }
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []

  for (const [sex, glbPath] of [['male', MALE_GLB], ['female', FEMALE_GLB]]) {
    if (!fs.existsSync(glbPath)) {
      console.warn(`跳过 ${sex}：找不到 ${glbPath}（需先 fbx2gltf 转换）`)
      continue
    }
    const srcDoc = await io.read(glbPath)
    const meshes = srcDoc.getRoot().listMeshes()
    console.log(`\n=== ${sex}：${meshes.length} 个网格 ===`)

    for (const mesh of meshes) {
      const info = parseMeshName(mesh.getName())
      if (!info || info.kind === 'unknown') {
        console.log(`  [跳过] ${mesh.getName()}（无法解析）`)
        continue
      }
      const slug = slugFor(info)
      const outPath = path.join(OUT_DIR, `${slug}.glb`)
      await exportOne(srcDoc, mesh.getName(), outPath, sex)
      summary.push({ sex, ...info, slug })
      console.log(`  [导出] ${mesh.getName()} -> ${slug}.glb`)
    }
  }

  // 汇总清单
  console.log(`\n共导出 ${summary.length} 个部位 glb 到 ${OUT_DIR}`)
  const bySex = { male: summary.filter((s) => s.sex === 'male').length, female: summary.filter((s) => s.sex === 'female').length }
  console.log(`  男性 ${bySex.male} 个，女性 ${bySex.female} 个`)
}

main().catch((e) => {
  console.error('导出失败:', e)
  process.exit(1)
})
