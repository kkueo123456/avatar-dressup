import {
  AnimationClip, type Bone, type Object3D, Quaternion, QuaternionKeyframeTrack,
} from 'three'

/**
 * 动画骨骼重定向：Quaternius 65 骨（小写下划线）→ JustCreate 62 骨（Mixamo 命名）。
 *
 * 问题背景：Quaternius 与 JustCreate 两套骨架的 rest pose 朝向不一致——不仅 `root`
 * 骨带 (-0.707,0,0,0.707) 的世界旋转（Z-up→Y-up 修正），而且每一根骨的 rest 局部旋转
 * 都不同。旧实现只改写轨道名、直接套源 quaternion，忽略了两者 rest 朝向差异，导致
 * 播放动画后人物倒立。
 *
 * 因此这里改为**烘焙式层级序 delta 重定向**：沿骨链自根向下，把源骨动画四元数转成
 * 相对其自身 rest 的"旋转增量"（delta），再叠加到目标骨 rest 朝向上，得到目标骨
 * 每帧的局部四元数，烘焙成 QuaternionKeyframeTrack。
 *
 *   srcWorld   = srcParentWorld * qAnim            （源骨当前世界旋转）
 *   delta      = srcWorld * srcRestWorld⁻¹          （相对源 rest 的旋转增量）
 *   dstWorld   = delta * dstRestWorld               （叠加到目标 rest 朝向）
 *   dstLocal   = dstParentWorld⁻¹ * dstWorld        （转回目标局部）
 *
 * quaternius 的 root / *_04_leaf / ball_leaf 在 JustCreate 无对应，直接丢弃。
 */
export const QUATERNIUS_TO_JUSTCREATE: Record<string, string> = {
  pelvis: 'Hips',
  spine_01: 'Spine',
  spine_02: 'Spine1',
  spine_03: 'Spine2',
  neck_01: 'Neck',
  Head: 'Head',
  clavicle_l: 'LeftShoulder',
  upperarm_l: 'LeftArm',
  lowerarm_l: 'LeftForeArm',
  hand_l: 'LeftHand',
  thumb_01_l: 'LeftHandThumb1',
  thumb_02_l: 'LeftHandThumb2',
  thumb_03_l: 'LeftHandThumb3',
  index_01_l: 'LeftHandIndex1',
  index_02_l: 'LeftHandIndex2',
  index_03_l: 'LeftHandIndex3',
  middle_01_l: 'LeftHandMiddle1',
  middle_02_l: 'LeftHandMiddle2',
  middle_03_l: 'LeftHandMiddle3',
  ring_01_l: 'LeftHandRing1',
  ring_02_l: 'LeftHandRing2',
  ring_03_l: 'LeftHandRing3',
  pinky_01_l: 'LeftHandPinky1',
  pinky_02_l: 'LeftHandPinky2',
  pinky_03_l: 'LeftHandPinky3',
  clavicle_r: 'RightShoulder',
  upperarm_r: 'RightArm',
  lowerarm_r: 'RightForeArm',
  hand_r: 'RightHand',
  thumb_01_r: 'RightHandThumb1',
  thumb_02_r: 'RightHandThumb2',
  thumb_03_r: 'RightHandThumb3',
  index_01_r: 'RightHandIndex1',
  index_02_r: 'RightHandIndex2',
  index_03_r: 'RightHandIndex3',
  middle_01_r: 'RightHandMiddle1',
  middle_02_r: 'RightHandMiddle2',
  middle_03_r: 'RightHandMiddle3',
  ring_01_r: 'RightHandRing1',
  ring_02_r: 'RightHandRing2',
  ring_03_r: 'RightHandRing3',
  pinky_01_r: 'RightHandPinky1',
  pinky_02_r: 'RightHandPinky2',
  pinky_03_r: 'RightHandPinky3',
  thigh_l: 'LeftUpLeg',
  calf_l: 'LeftLeg',
  foot_l: 'LeftFoot',
  ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg',
  calf_r: 'RightLeg',
  foot_r: 'RightFoot',
  ball_r: 'RightToeBase',
}

/** 反向映射：JustCreate 骨 → Quaternius 骨 */
const JUSTCREATE_TO_QUATERNIUS: Record<string, string> = Object.fromEntries(
  Object.entries(QUATERNIUS_TO_JUSTCREATE).map(([q, j]) => [j, q]),
)

/** 收集场景内所有 Bone 的信息（按对象身份索引），并缓存其 rest 世界四元数与父子关系 */
interface BoneInfo {
  bone: Bone
  restWorld: Quaternion
  children: BoneInfo[]
}

function collectBoneTree(root: Object3D): Map<string, BoneInfo> {
  root.updateMatrixWorld(true)
  // 关键：按 Bone 对象身份（而不是骨名）建索引。
  // Quaternius 骨架存在重名骨（如 middle_03_l 的末端子骨也叫 middle_03_l），
  // 若按名索引，子节点会查到自己，形成环 → 递归永不终止（前端表现为无限"加载中"）。
  const infos = new Map<Bone, BoneInfo>()
  const byName = new Map<string, BoneInfo>()
  const wq = new Quaternion()
  // 第一遍：为每个 Bone 建立 info 节点
  root.traverse((o) => {
    if ((o as Bone).isBone) {
      const b = o as Bone
      b.getWorldQuaternion(wq)
      const info: BoneInfo = { bone: b, restWorld: wq.clone(), children: [] }
      infos.set(b, info)
      if (!byName.has(b.name)) byName.set(b.name, info)
    }
  })
  // 第二遍：按对象身份连接父子
  root.traverse((o) => {
    if (!(o as Bone).isBone) return
    const info = infos.get(o as Bone)!
    for (const c of o.children) {
      if ((c as Bone).isBone) {
        const childInfo = infos.get(c as Bone)
        // 只有当子骨 info 不是自己时才连接（重名骨按身份不会是自己，双保险）
        if (childInfo && childInfo !== info) info.children.push(childInfo)
      }
    }
  })
  return byName
}

/** 轨道名形如 "upperarm_l.quaternion"，拆出骨名与属性 */
function splitTrackName(trackName: string): { bone: string; property: string } | null {
  const dot = trackName.indexOf('.')
  if (dot <= 0) return null
  return { bone: trackName.slice(0, dot), property: trackName.slice(dot + 1) }
}

/** 对单条四元数轨道在 t 时刻采样（QuaternionKeyframeTrack，slerp 插值） */
function sampleQuaternion(
  track: QuaternionKeyframeTrack,
  t: number,
  out: Quaternion,
): Quaternion {
  const times = track.times as Float32Array
  const values = track.values as Float32Array
  let i = 0
  while (i < times.length - 1 && times[i + 1] < t) i++
  const t0 = times[i]
  const t1 = times[Math.min(i + 1, times.length - 1)]
  const a = new Quaternion(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3])
  if (t1 <= t0 || t <= t0) return out.copy(a)
  const b = new Quaternion(
    values[(i + 1) * 4],
    values[(i + 1) * 4 + 1],
    values[(i + 1) * 4 + 2],
    values[(i + 1) * 4 + 3],
  )
  const alpha = Math.min(1, (t - t0) / (t1 - t0))
  return out.copy(a.slerp(b, alpha))
}

/**
 * 烘焙式 delta 重定向：把 Quaternius 动画剪辑烘焙成可直接给 JustCreate 底模播放的剪辑。
 *
 * @param clip          源动画剪辑（Quaternius 命名）
 * @param sourceScene   源动画文件的场景（含 Quaternius 骨架 rest pose）
 * @param targetScene   目标底模场景（含 JustCreate 骨架 rest pose）
 * @param fps           烘焙采样率（默认 30）
 */
export function retargetClipToJustCreate(
  clip: AnimationClip,
  sourceScene: Object3D,
  targetScene: Object3D,
  fps = 30,
): AnimationClip {
  const src = collectBoneTree(sourceScene)
  const dst = collectBoneTree(targetScene)

  // 源四元数轨道索引
  const srcTrack = new Map<string, QuaternionKeyframeTrack>()
  for (const track of clip.tracks) {
    const parts = splitTrackName(track.name)
    if (!parts || parts.property !== 'quaternion') continue
    if (!(track instanceof QuaternionKeyframeTrack)) continue
    srcTrack.set(parts.bone, track)
  }

  const duration = clip.duration
  const frames = Math.max(2, Math.round(duration * fps) + 1)
  const perBone = new Map<string, Float32Array>()
  const order: string[] = []

  // 源根骨（映射骨链顶端，通常 "pelvis"）的父世界 = 源 root 的 rest 世界旋转
  const srcRootWorld = src.get('root')?.restWorld.clone() ?? new Quaternion()
  const identity = new Quaternion()

  const bakeBoneRec = (
    srcInfo: BoneInfo,
    srcParentWorld: Quaternion,
    dstParentWorld: Quaternion,
    t: number,
    out: Map<string, Quaternion>,
  ): void => {
    const srcBoneName = srcInfo.bone.name
    const targetName = QUATERNIUS_TO_JUSTCREATE[srcBoneName]
    if (!targetName) return
    const dstInfo = dst.get(targetName)
    if (!dstInfo) return

    const qAnim = srcTrack.has(srcBoneName)
      ? sampleQuaternion(srcTrack.get(srcBoneName)!, t, new Quaternion())
      : srcInfo.bone.quaternion.clone()

    // srcWorld = srcParentWorld * qAnim
    // delta = srcWorld * srcRestWorld⁻¹
    // dstWorld = delta * dstRestWorld
    // dstLocal = dstParentWorld⁻¹ * dstWorld
    // 注意全部用 clone/新对象，绝不跨递归复用临时变量——
    // 否则父骨的中间值会被子骨的计算覆盖，子骨 local 全部被污染成恒等。
    const srcWorld = srcParentWorld.clone().multiply(qAnim)
    const delta = srcWorld.clone().multiply(srcInfo.restWorld.clone().invert())
    const dstWorld = delta.multiply(dstInfo.restWorld.clone())
    const local = dstParentWorld.clone().invert().multiply(dstWorld)
    out.set(targetName, local)

    // 递归子骨（按对象身份遍历，重名骨不会成环）
    for (const child of srcInfo.children) {
      if (QUATERNIUS_TO_JUSTCREATE[child.bone.name]) {
        bakeBoneRec(child, srcWorld, dstWorld, t, out)
      }
    }
  }

  const srcPelvis = src.get('pelvis')
  if (!srcPelvis) {
    // 没有 pelvis 骨架信息则退化为旧的"只改名"行为，避免崩溃
    return legacyRenameClip(clip)
  }

  for (let f = 0; f < frames; f++) {
    const t = Math.min(duration - 1e-4, (f / (frames - 1)) * duration)
    const locals = new Map<string, Quaternion>()
    bakeBoneRec(srcPelvis, srcRootWorld, identity, t, locals)
    for (const [bone, q] of locals) {
      let arr = perBone.get(bone)
      if (!arr) {
        arr = new Float32Array(frames * 4)
        perBone.set(bone, arr)
        order.push(bone)
      }
      arr.set([q.x, q.y, q.z, q.w], f * 4)
    }
  }

  const times = new Float32Array(frames)
  for (let f = 0; f < frames; f++) times[f] = (f / (frames - 1)) * duration
  const tracks = order.map(
    (bone) => new QuaternionKeyframeTrack(`${bone}.quaternion`, times, perBone.get(bone)!),
  )
  const retargeted = clip.clone()
  retargeted.tracks = tracks
  retargeted.name = `${clip.name}__jc`
  return retargeted
}

/** 旧版"只改写轨道名"的实现，作为无骨架信息时的兜底 */
function legacyRenameClip(clip: AnimationClip): AnimationClip {
  const tracks = clip.tracks
    .filter((track) => {
      const parts = splitTrackName(track.name)
      if (!parts) return true
      const mapped = QUATERNIUS_TO_JUSTCREATE[parts.bone]
      return !!mapped && parts.property === 'quaternion'
    })
    .map((track) => {
      const parts = splitTrackName(track.name)!
      const clone = track.clone()
      clone.name = `${QUATERNIUS_TO_JUSTCREATE[parts.bone]}.${parts.property}`
      return clone
    })
  const retargeted = clip.clone()
  retargeted.tracks = tracks
  retargeted.name = `${clip.name}__jc`
  return retargeted
}

export { JUSTCREATE_TO_QUATERNIUS }
