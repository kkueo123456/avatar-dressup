import { Bone, Matrix4, type Object3D, Skeleton, type SkinnedMesh } from 'three'

export function collectSkinnedMeshes(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = []
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) out.push(o as SkinnedMesh)
  })
  return out
}

export function buildBoneMap(skeleton: Skeleton): Map<string, Bone> {
  const map = new Map<string, Bone>()
  for (const b of skeleton.bones) if (!map.has(b.name)) map.set(b.name, b)
  return map
}

/**
 * 把 mesh 的骨骼按名字替换成目标骨骼。
 * 返回缺失的骨骼名；空数组表示成功，此时 mesh 已经绑定到目标骨骼。
 * 绑定矩阵用单位矩阵：部件网格直接挂在角色根节点下，自身不带变换。
 */
export function rebindToSkeleton(mesh: SkinnedMesh, boneByName: Map<string, Bone>): string[] {
  const missing: string[] = []
  const bones: Bone[] = []
  for (const b of mesh.skeleton.bones) {
    const target = boneByName.get(b.name)
    if (target) bones.push(target)
    else missing.push(b.name)
  }
  if (missing.length) return missing
  const inverses = mesh.skeleton.boneInverses.map((m) => m.clone())
  mesh.bind(new Skeleton(bones, inverses), new Matrix4())
  mesh.frustumCulled = false
  return []
}
