import { describe, expect, it } from 'vitest'
import {
  buildPresets, chooseAnimation, classifyFiles, detectPiece, detectSet, detectSex, slugify,
} from '../scripts/lib/classify.mjs'
import { nameLabels, pieceLabels, rules, setLabels, slotLabels, slots } from '../scripts/manifest.config.mjs'

const BASE = 'base/Universal Base Characters[Standard]'
const OUT = 'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)'
const files = [
  `${BASE}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`,
  `${BASE}/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Long.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_BuzzedFemale.gltf`,
  `${BASE}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Eyebrows_Female.gltf`,
  `${BASE}/Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Body.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Arms.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Legs.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Feet.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Head_Hood.gltf`,
  `${OUT}/Modular Parts/Female_Ranger_Acc_Pauldrons.gltf`,
  `${OUT}/Modular Parts/Male_Ranger_Feet_Boots.gltf`,
  `${OUT}/Modular Parts/Female_Peasant_Body.gltf`,
  `${OUT}/Outfits/Female_Ranger.gltf`,
  'anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
  'anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb',
  'misc/Thing.gltf',
]
const opts = { setLabels, slotLabels, pieceLabels, nameLabels }

describe('helpers', () => {
  it('slugify', () => expect(slugify('Ranger Body-01.glb')).toBe('ranger_body_01_glb'))
  it('detectSex 区分 Female、Male 与无性别', () => {
    expect(detectSex(files[0])).toBe('female')
    expect(detectSex(files[1])).toBe('male')
    expect(detectSex(files[3])).toBe('female')
    expect(detectSex(files[2])).toBe('any')
  })
  it('detectSet 去掉性别前缀后取文件名第一段', () => {
    expect(detectSet(`${OUT}/Modular Parts/Female_Ranger_Body.gltf`)).toBe('ranger')
    expect(detectSet('outfits/x/Ranger_Hood.gltf')).toBe('ranger')
  })
  it('detectPiece 取套装名之后的部分', () => {
    expect(detectPiece(`${OUT}/Modular Parts/Female_Ranger_Acc_Pauldrons.gltf`)).toBe('acc_pauldrons')
    expect(detectPiece(`${OUT}/Modular Parts/Male_Ranger_Feet_Boots.gltf`)).toBe('feet_boots')
    expect(detectPiece('outfits/x/Ranger_Hood.gltf')).toBe('hood')
  })
})

describe('classifyFiles', () => {
  const r = classifyFiles(files, rules, opts)

  it('底模带中文名，没有 bodyMeshes', () => {
    expect(r.bases.map((b) => [b.id, b.sex, b.label])).toEqual([
      ['superhero_female_fullbody', 'female', '女性'],
      ['superhero_male_fullbody', 'male', '男性'],
    ])
    expect(r.bases[0].url).toBe('models/base/superhero_female_fullbody.glb')
    expect(r.bases[0]).not.toHaveProperty('bodyMeshes')
  })

  it('只收 Rigged to Head Bone 的发型与眉毛，Origin at 0 不收', () => {
    const hair = r.parts.filter((p) => p.slot === 'hair')
    expect(hair.map((p) => [p.id, p.label, p.sex])).toEqual([
      ['hair_long', '长发', 'any'],
      ['hair_buzzedfemale', '寸头 女款', 'female'],
    ])
    expect(r.parts.find((p) => p.id === 'eyebrows_female').slot).toBe('eyebrows')
    expect(r.unmatched).toContain(`${BASE}/Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.gltf`)
  })

  it('服装按文件名归槽位，id 带性别，label 是套装加部位', () => {
    const female = r.parts.filter((p) => p.id.startsWith('female_ranger'))
    const bySlot = Object.fromEntries(female.filter((p) => p.slot !== 'accessory').map((p) => [p.slot, p]))
    expect(bySlot.body.label).toBe('游侠 上衣')
    expect(bySlot.body.url).toBe('models/outfits/ranger/female_ranger_body.glb')
    expect(bySlot.body.sex).toBe('female')
    expect(bySlot.arms.label).toBe('游侠 护臂')
    expect(bySlot.legs.label).toBe('游侠 长裤')
    expect(bySlot.feet.label).toBe('游侠 鞋')
    const byId = Object.fromEntries(r.parts.map((p) => [p.id, p]))
    expect(byId.female_ranger_head_hood.label).toBe('游侠 兜帽')
    expect(byId.female_ranger_head_hood.slot).toBe('accessory')
    expect(byId.female_ranger_acc_pauldrons.label).toBe('游侠 肩甲')
    expect(byId.male_ranger_feet_boots.label).toBe('游侠 长靴')
    expect(byId.male_ranger_feet_boots.slot).toBe('feet')
  })

  it('Outfits 整套文件不收', () => {
    expect(r.parts.some((p) => p.id === 'female_ranger')).toBe(false)
    expect(r.unmatched).toContain(`${OUT}/Outfits/Female_Ranger.gltf`)
  })

  it('动画只收非 _RM 的那个，其他目录不收', () => {
    expect(r.animations.map((a) => a.id)).toEqual(['ual1_standard'])
    expect(r.unmatched).toContain('anim/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb')
    expect(r.unmatched).toContain('misc/Thing.gltf')
  })

  it('所有部件的 variants 为空数组', () => {
    expect(r.parts.every((p) => Array.isArray(p.variants) && p.variants.length === 0)).toBe(true)
  })
})

describe('buildPresets', () => {
  it('四个服装槽位齐全的套装才生成预设，id 等于套装名', () => {
    const r = classifyFiles(files, rules, opts)
    const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
    expect(buildPresets(r.parts, outfitSlotIds, setLabels)).toEqual([
      {
        id: 'ranger',
        label: '游侠',
        parts: { body: 'female_ranger_body', arms: 'female_ranger_arms', legs: 'female_ranger_legs', feet: 'female_ranger_feet' },
      },
    ])
  })
})

describe('chooseAnimation', () => {
  it('优先选有 idle 剪辑的文件，否则取第一个文件的第一个剪辑', () => {
    expect(chooseAnimation([
      { id: 'a', clips: ['Run', 'Walk'] },
      { id: 'b', clips: ['Jump', 'Idle_Loop'] },
    ])).toEqual({ id: 'b', clip: 'Idle_Loop' })
    expect(chooseAnimation([{ id: 'a', clips: ['Run'] }])).toEqual({ id: 'a', clip: 'Run' })
    expect(chooseAnimation([{ id: 'a', clips: [] }])).toBeNull()
  })

  it('多个含 idle 的剪辑时优先选名字就是 Idle 或 Idle_Loop 的那个', () => {
    expect(chooseAnimation([{ id: 'a', clips: ['Crouch_Idle_Loop', 'Idle_Talking_Loop', 'Idle_Loop'] }]))
      .toEqual({ id: 'a', clip: 'Idle_Loop' })
    expect(chooseAnimation([{ id: 'a', clips: ['Crouch_Idle_Loop', 'Idle_Talking_Loop'] }]))
      .toEqual({ id: 'a', clip: 'Idle_Talking_Loop' })
  })
})
