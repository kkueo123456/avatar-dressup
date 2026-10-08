import { describe, expect, it } from 'vitest'
import {
  buildPresets, chooseAnimation, classifyFiles, detectSet, detectSex, slugify,
} from '../scripts/lib/classify.mjs'
import { rules, setLabels, slotLabels, slots } from '../scripts/manifest.config.mjs'

const files = [
  'base/Characters/Female_Regular.gltf',
  'base/Characters/Male_Superhero.gltf',
  'base/Hair/Hair_01.gltf',
  'base/Eyebrows/Eyebrows_Female.gltf',
  'outfits/Ranger/Ranger_Body.gltf',
  'outfits/Ranger/Ranger_Arms.gltf',
  'outfits/Ranger/Ranger_Legs.gltf',
  'outfits/Ranger/Ranger_Feet.gltf',
  'outfits/Ranger/Ranger_Hood.gltf',
  'outfits/Peasant/Peasant_Body.gltf',
  'anim/Universal_Animation_Library.gltf',
  'misc/Thing.gltf',
]

describe('helpers', () => {
  it('slugify', () => expect(slugify('Ranger Body-01.glb')).toBe('ranger_body_01_glb'))
  it('detectSex 区分 Female 与 Male', () => {
    expect(detectSex('base/Characters/Female_Regular.gltf')).toBe('female')
    expect(detectSex('base/Characters/Male_Regular.gltf')).toBe('male')
    expect(detectSex('outfits/Ranger/Ranger_Body.gltf')).toBe('any')
  })
  it('detectSet 取 outfits 下的文件夹名', () => {
    expect(detectSet('outfits/Ranger/Ranger_Body.gltf')).toBe('ranger')
    expect(detectSet('outfits/Peasant/Sub/Peasant_Body.gltf')).toBe('sub')
  })
})

describe('classifyFiles', () => {
  const r = classifyFiles(files, rules, { setLabels, slotLabels })

  it('底模', () => {
    expect(r.bases.map((b) => [b.id, b.sex])).toEqual([
      ['female_regular', 'female'],
      ['male_superhero', 'male'],
    ])
    expect(r.bases[0].url).toBe('models/base/female_regular.glb')
  })

  it('头部槽位没有 set', () => {
    const hair = r.parts.find((p) => p.id === 'hair_01')
    expect(hair.slot).toBe('hair')
    expect(hair.set).toBeNull()
    const brows = r.parts.find((p) => p.id === 'eyebrows_female')
    expect(brows.slot).toBe('eyebrows')
    expect(brows.sex).toBe('female')
  })

  it('服装按文件名归槽位，兜帽落到配饰，带套装中文名', () => {
    const bySlot = Object.fromEntries(r.parts.filter((p) => p.set === 'ranger').map((p) => [p.slot, p]))
    expect(Object.keys(bySlot).sort()).toEqual(['accessory', 'arms', 'body', 'feet', 'legs'])
    expect(bySlot.body.label).toBe('游侠 上身')
    expect(bySlot.body.url).toBe('models/outfits/ranger/ranger_body.glb')
    expect(bySlot.accessory.id).toBe('ranger_hood')
  })

  it('动画与未匹配文件', () => {
    expect(r.animations.map((a) => a.id)).toEqual(['universal_animation_library'])
    expect(r.unmatched).toEqual(['misc/Thing.gltf'])
  })
})

describe('buildPresets', () => {
  it('只有四个服装槽位齐全的套装才生成预设', () => {
    const r = classifyFiles(files, rules, { setLabels, slotLabels })
    const outfitSlotIds = slots.filter((s) => s.outfit).map((s) => s.id)
    const presets = buildPresets(r.parts, outfitSlotIds, setLabels)
    expect(presets).toEqual([
      { id: 'ranger', label: '游侠', parts: { body: 'ranger_body', arms: 'ranger_arms', legs: 'ranger_legs', feet: 'ranger_feet' } },
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
})
