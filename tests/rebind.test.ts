import { describe, expect, it } from 'vitest'
import { buildBoneMap, collectSkinnedMeshes, rebindToSkeleton } from '@/avatar/rebind'
import { makeRig } from './fixtures/rig'

describe('collectSkinnedMeshes / buildBoneMap', () => {
  it('找到蒙皮网格并按名字建骨骼表', () => {
    const { root, mesh } = makeRig(['root', 'spine', 'head'])
    expect(collectSkinnedMeshes(root)).toEqual([mesh])
    const map = buildBoneMap(mesh.skeleton)
    expect([...map.keys()]).toEqual(['root', 'spine', 'head'])
  })
})

describe('rebindToSkeleton', () => {
  it('骨骼名全部匹配时绑定到目标骨骼并返回空数组', () => {
    const target = makeRig(['root', 'spine', 'head'])
    const partRig = makeRig(['root', 'spine', 'head'], 'Shirt')
    const missing = rebindToSkeleton(partRig.mesh, buildBoneMap(target.mesh.skeleton))
    expect(missing).toEqual([])
    expect(partRig.mesh.skeleton.bones[1]).toBe(target.bones[1])
    expect(partRig.mesh.frustumCulled).toBe(false)
  })

  it('缺骨骼时返回缺失名并保持原骨骼不变', () => {
    const target = makeRig(['root', 'spine', 'head'])
    const partRig = makeRig(['root', 'spine', 'tail'], 'Shirt')
    const before = partRig.mesh.skeleton
    const missing = rebindToSkeleton(partRig.mesh, buildBoneMap(target.mesh.skeleton))
    expect(missing).toEqual(['tail'])
    expect(partRig.mesh.skeleton).toBe(before)
  })
})
