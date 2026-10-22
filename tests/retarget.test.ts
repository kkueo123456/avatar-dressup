import { describe, expect, it } from 'vitest'
import {
  AnimationClip, Bone, Group, type Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack,
} from 'three'
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

describe('retargetClipToJustCreate（烘焙式 delta 重定向）', () => {
  /** 构造一个最小源（Quaternius）骨架：root → pelvis → spine_01 → Head */
  function makeSourceScene(): Group {
    const root = new Group()
    const mk = (name: string, parent: Object3D) => {
      const b = new Bone()
      b.name = name
      parent.add(b)
      return b
    }
    const r = mk('root', root)
    const pelvis = mk('pelvis', r)
    const spine = mk('spine_01', pelvis)
    mk('Head', spine)
    return root
  }

  /** 构造一个最小目标（JustCreate）骨架：Armature → Hips → Spine → Head */
  function makeTargetScene(): Group {
    const root = new Group()
    const mk = (name: string, parent: Object3D) => {
      const b = new Bone()
      b.name = name
      parent.add(b)
      return b
    }
    const arm = mk('Armature', root)
    const hips = mk('Hips', arm)
    const spine = mk('Spine', hips)
    mk('Head', spine)
    return root
  }

  function makeClip(): AnimationClip {
    const times = [0, 1]
    return new AnimationClip('idle', 1, [
      new QuaternionKeyframeTrack('upperarm_l.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new VectorKeyframeTrack('pelvis.position', times, [0, 1, 0, 0, 1, 0]),
      new QuaternionKeyframeTrack('root.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new QuaternionKeyframeTrack('index_04_leaf_l.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
    ])
  }

  it('烘焙后输出 JustCreate 命名的四元数轨道，且不修改原剪辑', () => {
    const source = makeClip()
    const retargeted = retargetClipToJustCreate(source, makeSourceScene(), makeTargetScene())

    // 输出全部是 JustCreate 命名的 quaternion 轨道（pelvis→Hips、spine_01→Spine、Head→Head）
    const names = retargeted.tracks.map((t) => t.name).sort()
    expect(names).toEqual(['Head.quaternion', 'Hips.quaternion', 'Spine.quaternion'])

    // 原剪辑保持不变
    expect(source.tracks.map((t) => t.name)).toEqual([
      'upperarm_l.quaternion',
      'pelvis.position',
      'root.quaternion',
      'index_04_leaf_l.quaternion',
    ])
  })

  it('两套骨架 rest 朝向相同时，静止姿态烘焙结果等于源 rest 四元数', () => {
    // 源动画对 pelvis/spine/Head 均为单位四元数（无旋转）
    const times = [0, 1]
    const clip = new AnimationClip('idle', 1, [
      new QuaternionKeyframeTrack('pelvis.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new QuaternionKeyframeTrack('spine_01.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new QuaternionKeyframeTrack('Head.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
    ])
    const retargeted = retargetClipToJustCreate(clip, makeSourceScene(), makeTargetScene())
    // 3 条轨道；由于两套 rest 朝向相同且源静止，所有采样帧都应是单位四元数
    expect(retargeted.tracks).toHaveLength(3)
    for (const t of retargeted.tracks) {
      const vals = t.values as Float32Array
      for (let i = 0; i < vals.length; i += 4) {
        expect([vals[i], vals[i + 1], vals[i + 2], vals[i + 3]]).toEqual([0, 0, 0, 1])
      }
    }
  })

  it('丢弃 position/scale 轨道：Quaternius 米尺度平移套到 0.01 尺度会把人物甩出视野', () => {
    const times = [0, 1]
    const source = new AnimationClip('run', 1, [
      new QuaternionKeyframeTrack('Head.quaternion', times, [0, 0, 0, 1, 0, 0, 0, 1]),
      new VectorKeyframeTrack('pelvis.position', times, [0, 0.9, 0, 0, 0.95, 0]),
      new VectorKeyframeTrack('upperarm_l.scale', times, [1, 1, 1, 1, 1, 1]),
    ])
    const retargeted = retargetClipToJustCreate(source, makeSourceScene(), makeTargetScene())
    // position/scale 轨道被丢弃；只保留四元数轨道（Head 及其祖先 Hips/Spine 链）
    const names = retargeted.tracks.map((t) => t.name)
    expect(names).toContain('Head.quaternion')
    expect(names.every((n) => n.endsWith('.quaternion'))).toBe(true)
  })
})
