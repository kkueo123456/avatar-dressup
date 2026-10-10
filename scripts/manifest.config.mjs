// 解压素材后先运行 `npm run assets:scan`，对照输出调整这里的 rules 与各 labels。
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

/** 套装名（文件名去掉性别前缀后的第一段，小写）到中文名 */
export const setLabels = {
  ranger: '游侠', peasant: '农夫', knight: '骑士', noble: '贵族', wizard: '法师',
  mage: '法师', rogue: '盗贼', priest: '牧师', barbarian: '野蛮人', archer: '弓手',
  merchant: '商人', king: '国王', queen: '女王', druid: '德鲁伊',
}

/** 服装文件名在套装名之后的那段（小写、下划线）到中文名；没列的退回槽位名 */
export const pieceLabels = {
  body: '上衣', arms: '护臂', legs: '长裤', feet: '鞋', feet_boots: '长靴',
  acc_pauldron: '肩甲', acc_pauldrons: '肩甲', head_hood: '兜帽',
}

/** 按整个文件名 slug 精确匹配的中文名：底模、发型、眉毛 */
export const nameLabels = {
  superhero_female_fullbody: '女性', superhero_male_fullbody: '男性',
  hair_long: '长发', hair_buns: '丸子头', hair_buzzed: '寸头', hair_buzzedfemale: '寸头 女款',
  hair_simpleparted: '分头', hair_beard: '胡须',
  eyebrows_regular: '常规眉', eyebrows_female: '女性眉',
}

/**
 * 按顺序匹配，第一条命中生效。
 * 只扫三个来源目录里真正要用的子目录：底模的 Base Characters、发型眉毛的 Rigged to Head Bone、
 * 服装的 Modular Parts、动画里不带 _RM（根运动）的文件。其余一律落到 unmatched。
 */
export const rules = [
  { test: /^base\/.*Rigged to Head Bone\/.*\/eyebrows?\w*\.(glb|gltf)$/i, kind: 'part', slot: 'eyebrows' },
  { test: /^base\/.*Rigged to Head Bone\/.*\/hair\w*\.(glb|gltf)$/i, kind: 'part', slot: 'hair' },
  { test: /^base\/.*Base Characters\/.*\.(glb|gltf)$/i, kind: 'base' },
  { test: /^outfits\/.*Modular Parts\/.*_(body|torso|chest|shirt|robe)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'body' },
  { test: /^outfits\/.*Modular Parts\/.*_(arms?|sleeves?|gloves?|bracers?)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'arms' },
  { test: /^outfits\/.*Modular Parts\/.*_(legs?|pants|trousers|skirt)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'legs' },
  { test: /^outfits\/.*Modular Parts\/.*_(feet|foot|boots?|shoes?)\w*\.(glb|gltf)$/i, kind: 'part', slot: 'feet' },
  { test: /^outfits\/.*Modular Parts\/.*\.(glb|gltf)$/i, kind: 'part', slot: 'accessory' },
  { test: /^anim\/(?!.*_RM\.).*\.(glb|gltf)$/i, kind: 'animation' },
]
