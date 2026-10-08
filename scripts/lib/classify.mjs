/**
 * @typedef {{ test: RegExp, kind: 'base' | 'part' | 'animation', slot?: string }} Rule
 */

/** @param {string} s */
export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** @param {string} rel */
export function baseName(rel) {
  const file = rel.split('/').pop() ?? rel
  return file.replace(/\.(glb|gltf)$/i, '')
}

/** @param {string} rel @returns {'male'|'female'|'any'} */
export function detectSex(rel) {
  const name = baseName(rel)
  if (/female/i.test(name)) return 'female'
  if (/male/i.test(name)) return 'male'
  return 'any'
}

/** outfits/<Set>/.../x.gltf 取 x 的直接父文件夹名；其他取文件名第一段 */
export function detectSet(rel) {
  const segs = rel.split('/')
  if (segs[0] === 'outfits' && segs.length >= 3) return slugify(segs[segs.length - 2])
  const first = baseName(rel).split(/[_\-\s]/)[0]
  return first ? slugify(first) : null
}

/** @param {string} rel */
export function labelFromFile(rel) {
  return baseName(rel).replace(/[_\-]+/g, ' ').trim()
}

/**
 * @param {string[]} files 相对 assets-src 的路径，正斜杠
 * @param {Rule[]} rules 按顺序匹配，第一条命中生效
 * @param {{ setLabels?: Record<string,string>, slotLabels?: Record<string,string> }} [opts]
 */
export function classifyFiles(files, rules, opts = {}) {
  const setLabels = opts.setLabels ?? {}
  const slotLabels = opts.slotLabels ?? {}
  const out = { bases: [], parts: [], animations: [], unmatched: [] }
  for (const rel of files) {
    const rule = rules.find((r) => r.test.test(rel))
    if (!rule) {
      out.unmatched.push(rel)
      continue
    }
    const slug = slugify(baseName(rel))
    if (rule.kind === 'base') {
      out.bases.push({
        id: slug, sex: detectSex(rel), label: labelFromFile(rel), src: rel,
        url: `models/base/${slug}.glb`, bodyMeshes: [], headMeshes: [],
      })
    } else if (rule.kind === 'animation') {
      out.animations.push({ id: slug, label: labelFromFile(rel), src: rel, url: `anim/${slug}.glb`, clip: '' })
    } else {
      const slot = rule.slot ?? 'accessory'
      const headSlot = slot === 'hair' || slot === 'eyebrows'
      const set = headSlot ? null : detectSet(rel)
      const id = set && !slug.startsWith(set) ? `${set}_${slug}` : slug
      const dir = set ? `models/outfits/${set}` : `models/${slot}`
      const label = set && setLabels[set] ? `${setLabels[set]} ${slotLabels[slot] ?? slot}` : labelFromFile(rel)
      out.parts.push({ id, slot, set, label, sex: detectSex(rel), src: rel, url: `${dir}/${id}.glb`, variants: [] })
    }
  }
  return out
}

/**
 * @param {{ id: string, slot: string, set: string | null }[]} parts
 * @param {string[]} outfitSlotIds
 * @param {Record<string,string>} [setLabels]
 */
export function buildPresets(parts, outfitSlotIds, setLabels = {}) {
  /** @type {Map<string, Record<string,string>>} */
  const bySet = new Map()
  for (const p of parts) {
    if (!p.set || !outfitSlotIds.includes(p.slot)) continue
    if (!bySet.has(p.set)) bySet.set(p.set, {})
    const slotsOfSet = bySet.get(p.set)
    if (!slotsOfSet[p.slot]) slotsOfSet[p.slot] = p.id
  }
  const presets = []
  for (const [set, slotsOfSet] of bySet) {
    if (outfitSlotIds.every((s) => slotsOfSet[s])) {
      presets.push({ id: set, label: setLabels[set] ?? set, parts: slotsOfSet })
    }
  }
  return presets
}

/**
 * @param {{ id: string, clips: string[] }[]} candidates
 * @returns {{ id: string, clip: string } | null}
 */
export function chooseAnimation(candidates) {
  for (const c of candidates) {
    const idle = c.clips.find((n) => /idle/i.test(n))
    if (idle) return { id: c.id, clip: idle }
  }
  const first = candidates.find((c) => c.clips.length > 0)
  return first ? { id: first.id, clip: first.clips[0] } : null
}
