import type { AnimationClip, KeyframeTrack } from 'three'

/**
 * 动画骨骼重定向：Quaternius 65 骨（小写下划线）→ JustCreate 62 骨（Mixamo 命名）。
 * 动画文件是 Quaternius 命名；给 JustCreate 底模播放前按此表改写轨道名。
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

/** 轨道名形如 "upperarm_l.quaternion"，拆出骨名与属性 */
function splitTrackName(trackName: string): { bone: string; property: string } | null {
  const dot = trackName.indexOf('.')
  if (dot <= 0) return null
  return { bone: trackName.slice(0, dot), property: trackName.slice(dot + 1) }
}

/**
 * 把 Quaternius 命名的剪辑改写成 JustCreate 命名。
 * 返回新剪辑（不改原剪辑，剪辑缓存可能被两个体系共用）。
 */
export function retargetClipToJustCreate(clip: AnimationClip): AnimationClip {
  const tracks: KeyframeTrack[] = []
  for (const track of clip.tracks) {
    const parts = splitTrackName(track.name)
    if (!parts) {
      tracks.push(track)
      continue
    }
    const mapped = QUATERNIUS_TO_JUSTCREATE[parts.bone]
    if (!mapped) continue
    tracks.push(track.clone())
    tracks[tracks.length - 1].name = `${mapped}.${parts.property}`
  }
  const retargeted = clip.clone()
  retargeted.tracks = tracks
  retargeted.name = `${clip.name}__jc`
  return retargeted
}
