#!/usr/bin/env node
// 扫描 assets-src/，归类、优化、复制为单文件 glb，生成 public/avatar/manifest.json。
// 用法: node scripts/build-manifest.mjs [--scan]   --scan 只列出识别结果，不写文件。
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample, textureCompress } from '@gltf-transform/functions'
import { buildPresets, chooseAnimation, classifyFiles } from './lib/classify.mjs'
import { resolveGltfUris } from './lib/gltf-resources.mjs'
import { nameLabels, pieceLabels, rules, setLabels, skeleton, skeletons, slotLabels, slots } from './manifest.config.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'assets-src')
const OUT = path.join(ROOT, 'public', 'avatar')
const SCAN = process.argv.includes('--scan')
/** 贴图最长边，原素材是 4096，缩到 1024 并转 webp 后单张约 200 到 400 KB */
const TEXTURE_MAX = 1024

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

/**
 * 素材包里个别 .gltf 引用的贴图名和磁盘上的文件名差一个 "_png" 后缀（例如引用 T_Eye_Normal_png.png，
 * 实际是 T_Eye_Normal.png）。这类 uri 只在内存里改指到实际存在的文件，组成 resources 交给
 * io.readJSON；不往 assets-src 里复制副本，脚本可以反复重跑。
 * @param {string} abs
 */
async function readDoc(abs) {
  if (!/\.gltf$/i.test(abs)) return io.read(abs)
  const dir = path.dirname(abs)
  const json = JSON.parse(await readFile(abs, 'utf8'))
  const { entries, repairs } = resolveGltfUris(json, (rel) => existsSync(path.join(dir, rel)))
  const missing = entries.filter((e) => !e.actualUri).map((e) => e.uri)
  if (missing.length) throw new Error(`${path.basename(abs)} 引用的资源不存在：${missing.join('、')}`)
  // resources 的 key 必须是 JSON 里原样的 uri（readJSON 按字符串精确查找）
  const resources = {}
  for (const { uri, actualUri } of entries) {
    resources[uri] = await readFile(path.join(dir, decodeURIComponent(actualUri)))
  }
  for (const r of repairs) console.warn(`修复: ${path.basename(abs)} 引用 ${r.uri}，改用 ${r.from}`)
  return io.readJSON({ json, resources })
}

/** @param {string} abs */
async function inspect(abs) {
  const doc = await readDoc(abs)
  const root = doc.getRoot()
  const meshNames = root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName() || n.getMesh().getName())
  const joints = root.listSkins().reduce((m, s) => Math.max(m, s.listJoints().length), 0)
  const clips = root.listAnimations().map((a) => a.getName())
  return { doc, meshNames, joints, clips }
}

/** 去重、裁剪、重采样，贴图缩到 TEXTURE_MAX 并转 webp，写成单文件 glb。
 *  JustCreate 用调色板纹理（UV 指向 16x16 色块），不能缩放/重编码过度，只转 webp 不缩放。 */
async function writeGlb(doc, relUrl, { resizeTexture = true } = {}) {
  const transforms = resizeTexture
    ? [dedup(), prune(), resample(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_MAX, TEXTURE_MAX], quality: 85 })]
    : [dedup(), prune(), resample(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 })]
  await doc.transform(...transforms)
  const dest = path.join(OUT, relUrl)
  await mkdir(path.dirname(dest), { recursive: true })
  await io.write(dest, doc)
}

async function main() {
  const models = (await fg(['**/*.{glb,gltf}'], { cwd: SRC, onlyFiles: true })).sort()
  if (!models.length) {
    console.error('assets-src 下没有 glb/gltf 文件。请先按 docs/ASSETS.md 下载并解压素材。')
    process.exit(1)
  }
  const cls = classifyFiles(models, rules, { setLabels, slotLabels, pieceLabels, nameLabels })
  const kindOf = (rel) =>
    cls.bases.some((b) => b.src === rel) ? '底模'
    : cls.animations.some((a) => a.src === rel) ? '动画'
    : (cls.parts.find((p) => p.src === rel)?.slot ?? '未匹配')

  if (SCAN) {
    for (const rel of models) {
      const kind = kindOf(rel)
      if (kind === '未匹配') {
        console.log(`${rel}\n  归类: 未匹配`)
        continue
      }
      const { meshNames, joints, clips } = await inspect(path.join(SRC, rel))
      console.log(`${rel}\n  归类: ${kind}  骨骼: ${joints}  网格: ${meshNames.join(', ') || '(无)'}${clips.length ? `\n  动画: ${clips.length} 个剪辑，含 ${clips.filter((c) => /idle/i.test(c)).join(', ') || '无 idle'}` : ''}`)
    }
    return
  }

  // 增量清理：只删不在本次产物清单里的旧文件（rm 整目录会触发批量删除保护，
  // 且会误删仍在产物集内的文件再重写）。文件名稳定，正常重跑只会覆盖写入。
  await mkdir(OUT, { recursive: true })
  const keep = new Set([
    ...cls.bases.map((b) => b.url),
    ...cls.parts.map((p) => p.url),
    ...cls.animations.map((a) => a.url),
    'manifest.json',
  ])
  for (const rel of await fg(['**/*'], { cwd: OUT, onlyFiles: true })) {
    if (!keep.has(rel.replace(/\\/g, '/'))) await rm(path.join(OUT, rel), { force: true })
  }
  const warnings = []

  const rigOf = (entry) => entry.rig ?? 'quaternius'
  for (const b of cls.bases) {
    const { doc, joints } = await inspect(path.join(SRC, b.src))
    const expect = skeletons[rigOf(b)].expectedBones
    if (joints && joints !== expect) warnings.push(`${b.src} 骨骼数 ${joints}，期望 ${expect}`)
    await writeGlb(doc, b.url, { resizeTexture: rigOf(b) !== 'justcreate' })
    delete b.src
  }

  for (const p of cls.parts) {
    const { doc, joints } = await inspect(path.join(SRC, p.src))
    const expect = skeletons[rigOf(p)].expectedBones
    if (joints && joints !== expect) warnings.push(`${p.src} 骨骼数 ${joints}，期望 ${expect}`)
    await writeGlb(doc, p.url, { resizeTexture: rigOf(p) !== 'justcreate' })
    delete p.src
  }

  const candidates = []
  for (const a of cls.animations) {
    const { doc, clips } = await inspect(path.join(SRC, a.src))
    candidates.push({ id: a.id, clips, doc, ref: a })
  }
  const chosen = chooseAnimation(candidates)
  const animations = []
  if (chosen) {
    const c = candidates.find((x) => x.id === chosen.id)
    const root = c.doc.getRoot()
    // 只保留选中的剪辑；动画文件自带的网格和材质也用不到，一并丢掉，prune 会清掉它们的数据
    for (const anim of root.listAnimations()) {
      if (anim.getName() === chosen.clip) continue
      // 通道与采样器不随 Animation 一起释放，不手动清掉的话它们引用的 accessor 不会被 prune
      for (const ch of anim.listChannels()) ch.dispose()
      for (const s of anim.listSamplers()) s.dispose()
      anim.dispose()
    }
    for (const mesh of root.listMeshes()) mesh.dispose()
    for (const mat of root.listMaterials()) mat.dispose()
    c.ref.clip = chosen.clip
    c.ref.label = '待机'
    await writeGlb(c.doc, c.ref.url)
    delete c.ref.src
    animations.push(c.ref)
  } else if (cls.animations.length) {
    warnings.push('动画文件里没有任何剪辑')
  }

  const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
  const manifest = {
    version: 2, skeleton, skeletons, bases: cls.bases, slots, parts: cls.parts,
    presets: buildPresets(cls.parts, outfitSlotIds, setLabels), animations,
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  for (const s of slots) console.log(`${s.label}(${s.id}): ${cls.parts.filter((p) => p.slot === s.id).length}`)
  console.log(`底模 ${cls.bases.length}，预设 ${manifest.presets.length}，动画 ${animations.length}`)
  if (cls.unmatched.length) console.log(`未匹配 ${cls.unmatched.length} 个文件（整套 Outfits、Origin at 0 发型、_RM 动画属正常）`)
  for (const w of warnings) console.warn(`警告: ${w}`)
  console.log(`已写入 ${path.relative(ROOT, path.join(OUT, 'manifest.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
