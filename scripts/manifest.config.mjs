// 解压素材后先运行 `npm run assets:scan`，对照输出调整这里的 rules 与各 labels。

/** 骨架体系：quaternius 65 骨（root/pelvis/upperarm_l）；justcreate 62 骨（Hips/Spine/LeftArm） */
export const skeletons = {
  quaternius: { rootBone: 'root', expectedBones: 65 },
  justcreate: { rootBone: 'Hips', expectedBones: 62 },
}
/** 兼容字段：默认骨架体系 */
export const skeleton = skeletons.quaternius

export const slots = [
  { id: 'face', label: '脸', group: 'head', multiple: false, outfit: false },
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
  // JustCreate 系列
  base: '初始装', light: '轻甲', heavy: '重甲',
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
  // JustCreate 脸与发型（男女共用命名规则，靠文件名区分）
  sm_male_base_body: '男性·新体型', sm_female_base_body: '女性·新体型',
  sm_male_face_01: '脸 1', sm_male_face_02: '脸 2', sm_male_face_03: '脸 3',
  sm_male_face_04: '脸 4', sm_male_face_05: '脸 5', sm_female_face_01: '脸 1',
  sm_male_hair_01: '短发', sm_male_hair_02: '背头', sm_male_hair_03: '卷发',
  sm_male_hair_04: '长发', sm_male_hair_05: '光头', sm_female_hair_01: '马尾',
  sm_male_acc_01: '配饰 1', sm_male_acc_02: '配饰 2', sm_male_acc_03: '配饰 3',
  sm_male_acc_04: '配饰 4', sm_male_acc_05: '配饰 5', sm_male_acc_06: '配饰 6',
  sm_male_acc_07: '配饰 7', sm_male_acc_08: '配饰 8',
}

/**
 * 按顺序匹配，第一条命中生效。
 * 只扫三个来源目录里真正要用的子目录：底模的 Base Characters、发型眉毛的 Rigged to Head Bone、
 * 服装的 Modular Parts、动画里不带 _RM（根运动）的文件。其余一律落到 unmatched。
 */
export const rules = [
  // ---- JustCreate（scripts/export-justcreate.mjs 拆出的分部位 glb，文件名即语义）----
  // base_body 自带完整 62 骨骨架，直接作为该体型底模（其余 base 件作为初始装部件）
  { test: /^justcreate\/glb\/sm_(male|female)_base_body\.glb$/i, kind: 'base' },
  { test: /^justcreate\/glb\/sm_(male|female)_face_\d+\.glb$/i, kind: 'part', slot: 'face' },
  { test: /^justcreate\/glb\/sm_(male|female)_hair_\d+\.glb$/i, kind: 'part', slot: 'hair' },
  { test: /^justcreate\/glb\/sm_male_acc_\d+\.glb$/i, kind: 'part', slot: 'accessory' },
  { test: /^justcreate\/glb\/sm_(male|female)_[\w]+_body\.glb$/i, kind: 'part', slot: 'body' },
  { test: /^justcreate\/glb\/sm_(male|female)_[\w]+_arms\.glb$/i, kind: 'part', slot: 'arms' },
  { test: /^justcreate\/glb\/sm_(male|female)_[\w]+_legs\.glb$/i, kind: 'part', slot: 'legs' },
  { test: /^justcreate\/glb\/sm_(male|female)_[\w]+_boots\.glb$/i, kind: 'part', slot: 'feet' },
  // ---- Quaternius 原有素材 ----
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
