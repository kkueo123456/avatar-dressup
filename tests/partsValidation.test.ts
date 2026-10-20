import { describe, expect, it } from 'vitest'
import { validateParts } from '@/lib/partsValidation'

describe('validateParts（服务端 parts 校验）', () => {
  it('合法结构通过并保持数据', () => {
    const input = { hair: ['hair_long'], top: ['top_blue'], shoes: [] }
    expect(validateParts(input)).toEqual(input)
  })

  it('空对象合法（光身子保存）', () => {
    expect(validateParts({})).toEqual({})
  })

  it('字符串被拒绝（历史缺陷：任意 JSON 曾可入库）', () => {
    expect(validateParts('not-an-object')).toBeNull()
  })

  it('数组被拒绝', () => {
    expect(validateParts(['hair_long'])).toBeNull()
  })

  it('null / undefined / 数字被拒绝', () => {
    expect(validateParts(null)).toBeNull()
    expect(validateParts(undefined)).toBeNull()
    expect(validateParts(42)).toBeNull()
  })

  it('槽位值不是数组被拒绝', () => {
    expect(validateParts({ hair: 'hair_long' })).toBeNull()
    expect(validateParts({ hair: { id: 'hair_long' } })).toBeNull()
  })

  it('数组内非字符串被拒绝', () => {
    expect(validateParts({ hair: [123] })).toBeNull()
    expect(validateParts({ hair: [null] })).toBeNull()
    expect(validateParts({ hair: ['ok', 456] })).toBeNull()
  })

  it('空字符串 ID 被拒绝', () => {
    expect(validateParts({ hair: [''] })).toBeNull()
  })

  it('槽位数量超上限被拒绝（防 DoS 大对象）', () => {
    const tooMany: Record<string, string[]> = {}
    for (let i = 0; i < 65; i++) tooMany[`slot_${i}`] = []
    expect(validateParts(tooMany)).toBeNull()
  })

  it('单槽位部件数超上限被拒绝', () => {
    const ids = Array.from({ length: 33 }, (_, i) => `part_${i}`)
    expect(validateParts({ hair: ids })).toBeNull()
  })

  it('重复 ID 被去重（规范化）', () => {
    const result = validateParts({ hair: ['a', 'a', 'b'] })
    expect(result).toEqual({ hair: ['a', 'b'] })
  })

  it('超长 ID 被拒绝', () => {
    expect(validateParts({ hair: ['x'.repeat(129)] })).toBeNull()
    expect(validateParts({ ['x'.repeat(129)]: [] })).toBeNull()
  })
})
