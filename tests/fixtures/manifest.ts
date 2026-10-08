import type { Manifest, Part } from '@/types/manifest'

function outfit(set: string, slot: string): Part {
  return {
    id: `${set}_${slot}`,
    slot,
    set,
    label: `${set} ${slot}`,
    sex: 'any',
    url: `models/outfits/${set}/${set}_${slot}.glb`,
    variants:
      slot === 'body'
        ? [
            { id: 'a', label: 'A', textures: { map: `textures/${set}/${set}_A.png` } },
            { id: 'b', label: 'B', textures: { map: `textures/${set}/${set}_B.png` } },
          ]
        : [],
  }
}

export function makeManifest(): Manifest {
  return {
    version: 1,
    skeleton: { rootBone: 'root', expectedBones: 65 },
    bases: [
      { id: 'female_regular', sex: 'female', label: '女性', url: 'models/base/Female.glb', bodyMeshes: ['Body'], headMeshes: ['Head'] },
      { id: 'male_regular', sex: 'male', label: '男性', url: 'models/base/Male.glb', bodyMeshes: ['Body'], headMeshes: ['Head'] },
    ],
    slots: [
      { id: 'hair', label: '发型', group: 'head', multiple: false, outfit: false },
      { id: 'eyebrows', label: '眉毛', group: 'head', multiple: false, outfit: false },
      { id: 'body', label: '上身', group: 'outfit', multiple: false, outfit: true },
      { id: 'arms', label: '手臂', group: 'outfit', multiple: false, outfit: true },
      { id: 'legs', label: '腿部', group: 'outfit', multiple: false, outfit: true },
      { id: 'feet', label: '鞋靴', group: 'outfit', multiple: false, outfit: true },
      { id: 'accessory', label: '配饰', group: 'outfit', multiple: true, outfit: false },
    ],
    parts: [
      outfit('ranger', 'body'), outfit('ranger', 'arms'), outfit('ranger', 'legs'), outfit('ranger', 'feet'),
      outfit('peasant', 'body'), outfit('peasant', 'arms'), outfit('peasant', 'legs'), outfit('peasant', 'feet'),
      { id: 'hair_f', slot: 'hair', set: null, label: '女发', sex: 'female', url: 'models/base/Hair_F.glb', variants: [] },
      { id: 'hair_m', slot: 'hair', set: null, label: '男发', sex: 'male', url: 'models/base/Hair_M.glb', variants: [] },
      { id: 'hood', slot: 'accessory', set: 'ranger', label: '兜帽', sex: 'any', url: 'models/outfits/ranger/Hood.glb', variants: [] },
      { id: 'pauldron', slot: 'accessory', set: null, label: '护肩', sex: 'any', url: 'models/outfits/misc/Pauldron.glb', variants: [] },
    ],
    presets: [
      { id: 'ranger', label: '游侠', parts: { body: 'ranger_body', arms: 'ranger_arms', legs: 'ranger_legs', feet: 'ranger_feet' } },
      { id: 'peasant', label: '农夫', parts: { body: 'peasant_body', arms: 'peasant_arms', legs: 'peasant_legs', feet: 'peasant_feet' } },
    ],
    animations: [{ id: 'idle', label: '待机', url: 'anim/Idle.glb', clip: 'Idle' }],
  }
}

export function part(m: Manifest, id: string): Part {
  const p = m.parts.find((x) => x.id === id)
  if (!p) throw new Error(`fixture 没有部件 ${id}`)
  return p
}
