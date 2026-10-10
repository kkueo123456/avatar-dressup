import { describe, expect, it } from 'vitest'
import { clearError, updateLoading } from '@/state/loadState'

describe('updateLoading', () => {
  it('start 加入、end 移除，且不改原集合', () => {
    const a = updateLoading(new Set(), 'start', 'x')
    expect([...a]).toEqual(['x'])
    const b = updateLoading(a, 'end', 'x')
    expect(b.size).toBe(0)
    expect(a.size).toBe(1)
  })
})

describe('clearError', () => {
  it('有该 id 的错误时返回去掉它的新表', () => {
    const errors = new Map([['x', '网络错误'], ['y', '缺骨骼']])
    const next = clearError(errors, 'x')
    expect(next.has('x')).toBe(false)
    expect(next.get('y')).toBe('缺骨骼')
    expect(errors.has('x')).toBe(true)
  })

  it('没有该 id 的错误时原样返回同一个引用，避免无谓重渲染', () => {
    const errors = new Map([['y', '缺骨骼']])
    expect(clearError(errors, 'x')).toBe(errors)
  })
})
