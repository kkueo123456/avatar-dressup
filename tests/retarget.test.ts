import { describe, expect, it } from 'vitest'
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { QUATERNIUS_TO_JUSTCREATE, retargetClipToJustCreate } from '@/avatar/retarget'

/** JustCreate 62 骨骨名清单（来自 sm_male_base_body.glb） */
const JUSTCREATE_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3', 'LeftHandThumb4',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3', 'LeftHandIndex4',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3', 'LeftHandMiddle4',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3', 'LeftHandRing4',
  'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3', 'LeftHandPinky4',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3', 'RightHandThumb4',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3', 'RightHandIndex4',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3', 'RightHandMiddle4',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3', 'RightHandRing4',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3', 'RightHandPinky4',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
]

/** 动画里实际出现的 65 骨（来自 Quaternius 动画文件轨道） */
const ANIMATED_QUATERNIUS_BONES = [
  'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'index_01_l', 'index_02_l', 'index_03_l', 'index_04_leaf_l',
  'middle_01_l', 'middle_02_l', 'middle_03_l', 'middle_04_leaf_l',
  'pinky_01_l', 'pinky_02_l', 'pinky_03_l', 'pinky_04_leaf_l',
  'ring_01_l', 'ring_02_l', 'ring_03_l', 'ring_04_leaf_l',
  'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'thumb_04_leaf_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'index_01_r', 'index_02_r', 'index_03_r', 'index_04_leaf_r',
  'middle_01_r', 'middle_02_r', 'middle_03_r', 'middle_04_leaf_r',
  'pinky_01_r', 'pinky_02_r', 'pinky_03_r', 'pinky_04_leaf_r',
  'ring_01_r', 'ring_02_r', 'ring_03_r', 'ring_04_leaf_r',
  'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'thumb_04_leaf_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l',
  'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'ball_leaf_r',
]

describe('骨骼重定向映射表', () => {
  it('映射目标全部是 JustCreate 真实骨名', () => {
    for (const target of Object.values(QUATERNIUS_TO_JUSTCREATE)) {
      expect(JUSTCREATE_BONES, `目标骨 ${target} 不在 JustCreate 骨架中`).toContain(target)
    }
  })

  it('动画涉及的骨骼除 root/ball_leaf/*_04_leaf 外全部有映射', () => {
    const unmapped = ANIMATED_QUATERNIUS_BONES.filter(
      (b) => !QUATERNIUS_TO_JUSTCREATE[b] && !/^(root|ball_leaf|.*_04_leaf)/.test(b),
    )
    expect(unmapped).toEqual([])
  })
})

describe('retargetClipToJustCreate', () => {
  function makeClip(): AnimationClip {
    const times = [0, 1]
    return new AnimationClip('idle', 1, [
      new QuaternionKeyframeTrack('upperarm_l.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new VectorKeyframeTrack('pelvis.position', times, [0, 1, 0, 0, 1, 0]),
      new QuaternionKeyframeTrack('root.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new QuaternionKeyframeTrack('index_04_leaf_l.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
    ])
  }

  it('改写已映射骨名、丢弃无对应轨道、不修改原剪辑', () => {
    const source = makeClip()
    const retargeted = retargetClipToJustCreate(source)
    expect(retargeted.tracks.map((t) => t.name)).toEqual([
      'LeftArm.quaternion',
      'Hips.position',
    ])
    // 原剪辑保持不变
    expect(source.tracks.map((t) => t.name)).toEqual([
      'upperarm_l.quaternion',
      'pelvis.position',
      'root.quaternion',
      'index_04_leaf_l.quaternion',
    ])
  })
})
