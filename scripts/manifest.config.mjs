// 解压素材后先运行 `npm run assets:scan`，对照输出调整这里的 rules 与 variantFor。
import { slugify } from './lib/classify.mjs'

export const skeleton = { rootBone: 'root', expectedBones: 65 }

export const slots = [
  { id: 'hair', label: '发型', group: 'head', multiple: false, outfit: false },
  { id: 'eyebrows', label: '眉毛', group: 'head', multiple: false, outfit: false },
  { id: 'body', label: '上身', group: 'outfit', multiple: false, outfit: true },
  { id: 'arms', label: '手臂', group: 'outfit', multiple: false, outfit: true },
  { id: 'legs', label: '腿部', group: 'outfit', multiple: false, outfit: true },
  { id: 'feet', label: '鞋靴', group: 'outfit', multiple: false, outfit: true },
  { id: 'accessory', label: '配饰', group: 'outfit', multiple: true, outfit: false },
]

export const slotLabels = Object.fromEntries(slots.map((s) => [s.id, s.label]))

export const setLabels = {
  ranger: '游侠', peasant: '农夫', knight: '骑士', noble: '贵族', wizard: '法师',
  mage: '法师', rogue: '盗贼', priest: '牧师', barbarian: '野蛮人', archer: '弓手',
  merchant: '商人', king: '国王', queen: '女王', druid: '德鲁伊',
}

/** 按顺序匹配，第一条命中生效。头部规则必须排在底模规则前面。 */
export const rules = [
  { test: /^base\/.*(eyebrow|brow)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'eyebrows' },
  { test: /^base\/.*hair\w*\.(glb|gltf)$/i, kind: 'part', slot: 'hair' },
  { test: /^base\/.*(male|female)\w*\.(glb|gltf)$/i, kind: 'base' },
  { test: /^outfits\/.*(body|torso|chest|shirt|robe)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'body' },
  { test: /^outfits\/.*(arm|arms|sleeve|glove|bracer)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'arms' },
  { test: /^outfits\/.*(leg|legs|pants|trousers|skirt)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'legs' },
  { test: /^outfits\/.*(feet|foot|boot|boots|shoe|shoes)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'feet' },
  { test: /^outfits\/.*\.(glb|gltf)$/i, kind: 'part', slot: 'accessory' },
  { test: /^anim\/.*\.(glb|gltf)$/i, kind: 'animation' },
]

/**
 * 贴图变体识别。返回 null 表示这张 PNG 不是服装变体贴图。
 * 默认假设路径形如 outfits/Ranger/Textures/Ranger_B.png：套装名 + 分隔符 + 变体标记。
 * @param {string} pngRel
 * @returns {{ set: string, variantId: string, label: string } | null}
 */
export function variantFor(pngRel) {
  const m = /^outfits\/(?:[^/]+\/)*([A-Za-z]+)[_-]([A-Za-z0-9]{1,3})\.png$/i.exec(pngRel)
  if (!m) return null
  return { set: slugify(m[1]), variantId: m[2].toLowerCase(), label: m[2].toUpperCase() }
}
