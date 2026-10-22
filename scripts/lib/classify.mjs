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

/** 去掉 Female_ / Male_ 前缀后的文件名分段；JustCreate 导出文件带 sm_ 前缀，一并剥掉 */
function tokens(rel) {
  const name = baseName(rel).replace(/^(sm[_\-\s]+)?(female|male)[_\-\s]+/i, '')
  return name.split(/[_\-\s]+/).filter(Boolean)
}

/** 套装名：去掉性别前缀后的第一段，例如 Female_Ranger_Body -> ranger */
export function detectSet(rel) {
  const [first] = tokens(rel)
  return first ? slugify(first) : null
}

/** 部位段：套装名之后的部分，例如 Male_Ranger_Feet_Boots -> feet_boots */
export function detectPiece(rel) {
  return slugify(tokens(rel).slice(1).join('_'))
}

/** @param {string} rel */
export function labelFromFile(rel) {
  return baseName(rel).replace(/[_\-]+/g, ' ').trim()
}

/** 骨架体系：justcreate 目录下的是 JustCreate 62 骨 Mixamo 命名，其余是 Quaternius 65 骨 */
export function detectRig(rel) {
  return /^justcreate\//i.test(rel) ? 'justcreate' : 'quaternius'
}

/**
 * @param {string[]} files 相对 assets-src 的路径，正斜杠
 * @param {Rule[]} rules 按顺序匹配，第一条命中生效
 * @param {{ setLabels?: Record<string,string>, slotLabels?: Record<string,string>,
 *           pieceLabels?: Record<string,string>, nameLabels?: Record<string,string> }} [opts]
 */
export function classifyFiles(files, rules, opts = {}) {
  const setLabels = opts.setLabels ?? {}
  const slotLabels = opts.slotLabels ?? {}
  const pieceLabels = opts.pieceLabels ?? {}
  const nameLabels = opts.nameLabels ?? {}
  const out = { bases: [], parts: [], animations: [], unmatched: [] }
  for (const rel of files) {
    const rule = rules.find((r) => r.test.test(rel))
    if (!rule) {
      out.unmatched.push(rel)
      continue
    }
    const slug = slugify(baseName(rel))
    if (rule.kind === 'base') {
      const sex = detectSex(rel)
      out.bases.push({
        id: slug, sex, label: nameLabels[slug] ?? labelFromFile(rel), src: rel,
        url: `models/base/${slug}.glb`, rig: detectRig(rel),
        // JustCreate 底模只是躯干，初始装拼出完整人体：base 四肢 + 默认脸/发型
        ...(detectRig(rel) === 'justcreate' ? { initialParts: {
          face: `sm_${sex}_face_01`, hair: `sm_${sex}_hair_01`,
          arms: `sm_${sex}_base_arms`, legs: `sm_${sex}_base_legs`, feet: `sm_${sex}_base_boots`,
        } } : {}),
      })
    } else if (rule.kind === 'animation') {
      out.animations.push({ id: slug, label: labelFromFile(rel), src: rel, url: `anim/${slug}.glb`, clip: '' })
    } else {
      const slot = rule.slot ?? 'accessory'
      const headSlot = slot === 'hair' || slot === 'eyebrows' || slot === 'face'
      const set = headSlot ? null : detectSet(rel)
      const piece = headSlot ? '' : detectPiece(rel)
      const dir = set ? `models/outfits/${set}` : `models/${slot}`
      const label = nameLabels[slug]
        ?? (headSlot
          ? labelFromFile(rel)
          : `${setLabels[set] ?? set} ${pieceLabels[piece] ?? slotLabels[slot] ?? slot}`)
      out.parts.push({ id: slug, slot, set, label, sex: detectSex(rel), src: rel, url: `${dir}/${slug}.glb`, rig: detectRig(rel), variants: [] })
    }
  }
  return out
}

/**
 * 只有四个服装槽位齐全的套装才生成预设；预设 id 等于套装名，每个槽位记第一个遇到的部件 id。
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
  // 先找名字就是 Idle / Idle_Loop 的，再找以 Idle 开头的，最后才是任何含 idle 的（避免选中 Crouch_Idle_Loop）
  const prefer = [/^idle(_loop)?$/i, /^idle/i, /idle/i]
  for (const re of prefer) {
    for (const c of candidates) {
      const idle = c.clips.find((n) => re.test(n))
      if (idle) return { id: c.id, clip: idle }
    }
  }
  const first = candidates.find((c) => c.clips.length > 0)
  return first ? { id: first.id, clip: first.clips[0] } : null
}
