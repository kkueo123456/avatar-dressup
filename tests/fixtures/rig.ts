import { Bone, BufferGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from 'three'

/** 造一条链状骨骼和一个绑定其上的 SkinnedMesh，模拟 glTF 场景 */
export function makeRig(boneNames: string[], meshName = 'Body') {
  const bones = boneNames.map((n) => {
    const b = new Bone()
    b.name = n
    return b
  })
  for (let i = 1; i < bones.length; i++) bones[i - 1].add(bones[i])
  const root = new Group()
  root.add(bones[0])
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshStandardMaterial())
  mesh.name = meshName
  root.add(mesh)
  root.updateMatrixWorld(true)
  mesh.bind(new Skeleton(bones))
  return { root, mesh, bones }
}
