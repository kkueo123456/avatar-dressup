import { describe, expect, it } from 'vitest'
import { ManifestError, validateManifest } from '@/data/manifest'
import { makeManifest } from './fixtures/manifest'

function problemsOf(raw: unknown): string[] {
  try {
    validateManifest(raw)
  } catch (e) {
    if (e instanceof ManifestError) return e.problems
    throw e
  }
  return []
}

describe('validateManifest', () => {
  it('合法 manifest 原样返回', () => {
    const m = makeManifest()
    expect(validateManifest(m)).toEqual(m)
  })

  it('根节点不是对象时报错', () => {
    expect(problemsOf(null)).toEqual(['根节点必须是对象'])
  })

  it('缺 bases 和 slots 时同时报告两个问题', () => {
    const m = makeManifest() as unknown as Record<string, unknown>
    delete m.bases
    delete m.slots
    const problems = problemsOf(m)
    expect(problems.some((p) => p.includes('bases'))).toBe(true)
    expect(problems.some((p) => p.includes('slots'))).toBe(true)
  })

  it('部件引用不存在的槽位时报错并指出部件 id', () => {
    const m = makeManifest()
    m.parts[0].slot = 'tail'
    const problems = problemsOf(m)
    expect(problems).toContain('部件 ranger_body 引用了不存在的槽位 tail')
  })

  it('重复的部件 id 报错', () => {
    const m = makeManifest()
    m.parts[1].id = m.parts[0].id
    expect(problemsOf(m)).toContain('部件 id 重复：ranger_body')
  })

  it('预设引用了错误槽位的部件时报错', () => {
    const m = makeManifest()
    m.presets[0].parts.body = 'ranger_legs'
    expect(problemsOf(m)).toContain('预设 ranger 的槽位 body 指向的部件 ranger_legs 属于槽位 legs')
  })

  it('预设引用不存在的部件时报错', () => {
    const m = makeManifest()
    m.presets[0].parts.body = 'nope'
    expect(problemsOf(m)).toContain('预设 ranger 引用了不存在的部件 nope')
  })

  it('底模 sex 不合法时报错', () => {
    const m = makeManifest() as unknown as { bases: { sex: string }[] }
    m.bases[0].sex = 'any'
    expect(problemsOf(m)).toContain('底模 female_regular 的 sex 必须是 male 或 female')
  })

  it('变体缺少 textures.map 时报错', () => {
    const m = makeManifest() as unknown as { parts: { variants: { textures: unknown }[] }[] }
    m.parts[0].variants[0].textures = {}
    expect(problemsOf(m)).toContain('部件 ranger_body 的变体 a 缺少 textures.map')
  })
})
