#!/usr/bin/env node
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample } from '@gltf-transform/functions'
import { buildPresets, chooseAnimation, classifyFiles } from './lib/classify.mjs'
import { rules, setLabels, skeleton, slotLabels, slots, variantFor } from './manifest.config.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'assets-src')
const OUT = path.join(ROOT, 'public', 'avatar')
const args = new Set(process.argv.slice(2))
const SCAN = args.has('--scan')
const OPTIMIZE = args.has('--optimize')
const HEAD_RE = /head|eye|teeth|tongue|brow|lash|mouth/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

/** @param {string} abs */
async function inspect(abs) {
  const doc = await io.read(abs)
  const root = doc.getRoot()
  const meshNames = root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName() || n.getMesh().getName())
  const joints = root.listSkins().reduce((m, s) => Math.max(m, s.listJoints().length), 0)
  const clips = root.listAnimations().map((a) => a.getName())
  return { doc, meshNames, joints, clips }
}

/** @param {import('@gltf-transform/core').Document} doc @param {string} relUrl */
async function writeGlb(doc, relUrl) {
  if (OPTIMIZE) await doc.transform(dedup(), prune(), resample())
  const dest = path.join(OUT, relUrl)
  await mkdir(path.dirname(dest), { recursive: true })
  await io.write(dest, doc)
}

async function main() {
  const models = (await fg(['**/*.{glb,gltf}'], { cwd: SRC, onlyFiles: true })).sort()
  const pngs = (await fg(['**/*.png'], { cwd: SRC, onlyFiles: true })).sort()
  if (!models.length) {
    console.error('assets-src 下没有 glb/gltf 文件。请先按 docs/ASSETS.md 下载并解压素材。')
    process.exit(1)
  }
  const cls = classifyFiles(models, rules, { setLabels, slotLabels })
  const kindOf = (rel) =>
    cls.bases.some((b) => b.src === rel) ? '底模'
    : cls.animations.some((a) => a.src === rel) ? '动画'
    : (cls.parts.find((p) => p.src === rel)?.slot ?? '未匹配')

  if (SCAN) {
    for (const rel of models) {
      const { meshNames, joints, clips } = await inspect(path.join(SRC, rel))
      console.log(`${rel}\n  归类: ${kindOf(rel)}  骨骼: ${joints}  网格: ${meshNames.join(', ') || '(无)'}${clips.length ? `\n  动画: ${clips.join(', ')}` : ''}`)
    }
    console.log('\nPNG 贴图:')
    for (const p of pngs) console.log(`  ${p}  -> ${JSON.stringify(variantFor(p))}`)
    return
  }

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const warnings = []

  for (const b of cls.bases) {
    const { doc, meshNames, joints } = await inspect(path.join(SRC, b.src))
    if (joints !== skeleton.expectedBones) warnings.push(`${b.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    b.headMeshes = meshNames.filter((n) => HEAD_RE.test(n))
    b.bodyMeshes = meshNames.filter((n) => !HEAD_RE.test(n))
    if (b.sex === 'any') {
      warnings.push(`${b.src} 文件名没有 Male/Female，默认为 female`)
      b.sex = 'female'
    }
    await writeGlb(doc, b.url)
    delete b.src
  }

  for (const p of cls.parts) {
    const { doc, joints } = await inspect(path.join(SRC, p.src))
    if (joints && joints !== skeleton.expectedBones) warnings.push(`${p.src} 骨骼数 ${joints}，期望 ${skeleton.expectedBones}`)
    await writeGlb(doc, p.url)
    delete p.src
  }

  /** @type {Map<string, {id:string,label:string,textures:{map:string}}[]>} */
  const variantsBySet = new Map()
  for (const png of pngs) {
    const v = variantFor(png)
    if (!v) continue
    const url = `textures/${v.set}/${v.set}_${v.variantId}.png`
    const dest = path.join(OUT, url)
    await mkdir(path.dirname(dest), { recursive: true })
    await copyFile(path.join(SRC, png), dest)
    if (!variantsBySet.has(v.set)) variantsBySet.set(v.set, [])
    variantsBySet.get(v.set).push({ id: v.variantId, label: v.label, textures: { map: url } })
  }
  for (const p of cls.parts) {
    if (p.set && variantsBySet.has(p.set)) p.variants = variantsBySet.get(p.set)
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
    version: 1, skeleton, bases: cls.bases, slots, parts: cls.parts,
    presets: buildPresets(cls.parts, outfitSlotIds, setLabels), animations,
  }
  await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

  for (const s of slots) console.log(`${s.label}(${s.id}): ${cls.parts.filter((p) => p.slot === s.id).length}`)
  console.log(`底模 ${cls.bases.length}，预设 ${manifest.presets.length}，动画 ${animations.length}`)
  if (cls.unmatched.length) console.log(`未匹配 ${cls.unmatched.length} 个文件:\n  ${cls.unmatched.join('\n  ')}`)
  for (const w of warnings) console.warn(`警告: ${w}`)
  console.log(`已写入 ${path.relative(ROOT, path.join(OUT, 'manifest.json'))}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
