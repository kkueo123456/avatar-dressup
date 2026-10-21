export type Sex = 'male' | 'female' | 'any'
export type SlotGroup = 'head' | 'outfit'
/** 骨架体系：quaternius 65 骨小写命名；justcreate 62 骨 Mixamo 命名 */
export type Rig = 'quaternius' | 'justcreate'

export interface Manifest {
  version: number
  skeleton: { rootBone: string; expectedBones: number }
  /** 各骨架体系配置；缺省视为 quaternius（兼容旧 manifest） */
  skeletons?: Partial<Record<Rig, { rootBone: string; expectedBones: number }>>
  bases: BaseModel[]
  slots: Slot[]
  parts: Part[]
  presets: Preset[]
  animations: AnimationRef[]
}

export interface BaseModel {
  id: string
  sex: Exclude<Sex, 'any'>
  label: string
  url: string
  rig?: Rig
}

export interface Slot {
  id: string
  label: string
  group: SlotGroup
  /** 允许同时装多个（配饰） */
  multiple: boolean
  /** 参与底模可见性与预设补全（body/arms/legs/feet） */
  outfit: boolean
}

export interface Variant {
  id: string
  label: string
  textures: { map: string }
}

export interface Part {
  id: string
  slot: string
  set: string | null
  label: string
  sex: Sex
  url: string
  rig?: Rig
  variants: Variant[]
}

export interface Preset {
  id: string
  label: string
  /** slotId -> partId */
  parts: Record<string, string>
}

export interface AnimationRef {
  id: string
  label: string
  url: string
  clip: string
}
