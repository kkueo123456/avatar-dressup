import type { Manifest } from '@/types/manifest'
import { assetUrl } from './assetUrl'

export class ManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(`manifest 校验失败：\n${problems.join('\n')}`)
    this.name = 'ManifestError'
  }
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

export function validateManifest(raw: unknown): Manifest {
  if (!isRec(raw)) throw new ManifestError(['根节点必须是对象'])
  const problems: string[] = []
  const push = (p: string) => problems.push(p)

  if (typeof raw.version !== 'number') push('version 必须是数字')
  if (!isRec(raw.skeleton) || !isStr(raw.skeleton.rootBone) || typeof raw.skeleton.expectedBones !== 'number') {
    push('skeleton 需要 rootBone(string) 与 expectedBones(number)')
  }

  const arr = (key: string): unknown[] => {
    const v = raw[key]
    if (!Array.isArray(v)) {
      push(`${key} 必须是数组`)
      return []
    }
    return v
  }
  const bases = arr('bases')
  const slots = arr('slots')
  const parts = arr('parts')
  const presets = arr('presets')
  const animations = arr('animations')

  if (Array.isArray(raw.bases) && bases.length === 0) push('bases 至少需要一个底模')
  if (Array.isArray(raw.slots) && slots.length === 0) push('slots 至少需要一个槽位')

  const baseIds = new Set<string>()
  for (const b of bases) {
    if (!isRec(b) || !isStr(b.id)) { push('底模缺少 id'); continue }
    if (baseIds.has(b.id)) push(`底模 id 重复：${b.id}`)
    baseIds.add(b.id)
    if (b.sex !== 'male' && b.sex !== 'female') push(`底模 ${b.id} 的 sex 必须是 male 或 female`)
    if (!isStr(b.label)) push(`底模 ${b.id} 缺少 label`)
    if (!isStr(b.url)) push(`底模 ${b.id} 缺少 url`)
  }

  const slotIds = new Set<string>()
  for (const s of slots) {
    if (!isRec(s) || !isStr(s.id)) { push('槽位缺少 id'); continue }
    if (slotIds.has(s.id)) push(`槽位 id 重复：${s.id}`)
    slotIds.add(s.id)
    if (!isStr(s.label)) push(`槽位 ${s.id} 缺少 label`)
    if (s.group !== 'head' && s.group !== 'outfit') push(`槽位 ${s.id} 的 group 必须是 head 或 outfit`)
    if (!isBool(s.multiple)) push(`槽位 ${s.id} 的 multiple 必须是布尔值`)
    if (!isBool(s.outfit)) push(`槽位 ${s.id} 的 outfit 必须是布尔值`)
  }

  const partSlot = new Map<string, string>()
  for (const p of parts) {
    if (!isRec(p) || !isStr(p.id)) { push('部件缺少 id'); continue }
    if (partSlot.has(p.id)) push(`部件 id 重复：${p.id}`)
    if (!isStr(p.slot)) push(`部件 ${p.id} 缺少 slot`)
    else if (!slotIds.has(p.slot)) push(`部件 ${p.id} 引用了不存在的槽位 ${p.slot}`)
    partSlot.set(p.id, isStr(p.slot) ? p.slot : '')
    if (p.set !== null && !isStr(p.set)) push(`部件 ${p.id} 的 set 必须是字符串或 null`)
    if (!isStr(p.label)) push(`部件 ${p.id} 缺少 label`)
    if (p.sex !== 'male' && p.sex !== 'female' && p.sex !== 'any') push(`部件 ${p.id} 的 sex 必须是 male、female 或 any`)
    if (!isStr(p.url)) push(`部件 ${p.id} 缺少 url`)
    if (!Array.isArray(p.variants)) { push(`部件 ${p.id} 的 variants 必须是数组`); continue }
    const vIds = new Set<string>()
    for (const v of p.variants) {
      if (!isRec(v) || !isStr(v.id)) { push(`部件 ${p.id} 有变体缺少 id`); continue }
      if (vIds.has(v.id)) push(`部件 ${p.id} 的变体 id 重复：${v.id}`)
      vIds.add(v.id)
      if (!isStr(v.label)) push(`部件 ${p.id} 的变体 ${v.id} 缺少 label`)
      if (!isRec(v.textures) || !isStr(v.textures.map)) push(`部件 ${p.id} 的变体 ${v.id} 缺少 textures.map`)
    }
  }

  const presetIds = new Set<string>()
  for (const pr of presets) {
    if (!isRec(pr) || !isStr(pr.id)) { push('预设缺少 id'); continue }
    if (presetIds.has(pr.id)) push(`预设 id 重复：${pr.id}`)
    presetIds.add(pr.id)
    if (!isStr(pr.label)) push(`预设 ${pr.id} 缺少 label`)
    if (!isRec(pr.parts)) { push(`预设 ${pr.id} 的 parts 必须是对象`); continue }
    for (const [slotId, partId] of Object.entries(pr.parts)) {
      if (!slotIds.has(slotId)) push(`预设 ${pr.id} 引用了不存在的槽位 ${slotId}`)
      if (!isStr(partId) || !partSlot.has(partId)) { push(`预设 ${pr.id} 引用了不存在的部件 ${String(partId)}`); continue }
      const actual = partSlot.get(partId)
      if (actual !== slotId) push(`预设 ${pr.id} 的槽位 ${slotId} 指向的部件 ${partId} 属于槽位 ${actual}`)
    }
  }

  const animIds = new Set<string>()
  for (const a of animations) {
    if (!isRec(a) || !isStr(a.id)) { push('动画缺少 id'); continue }
    if (animIds.has(a.id)) push(`动画 id 重复：${a.id}`)
    animIds.add(a.id)
    if (!isStr(a.label)) push(`动画 ${a.id} 缺少 label`)
    if (!isStr(a.url)) push(`动画 ${a.id} 缺少 url`)
    if (!isStr(a.clip)) push(`动画 ${a.id} 缺少 clip`)
  }

  if (problems.length) throw new ManifestError(problems)
  return raw as unknown as Manifest
}

export async function loadManifest(url = assetUrl('manifest.json')): Promise<Manifest> {
  const res = await fetch(url)
  if (!res.ok) throw new ManifestError([`无法读取 ${url}：HTTP ${res.status}`])
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new ManifestError([`${url} 不是合法 JSON`])
  }
  return validateManifest(json)
}
