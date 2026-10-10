/** 视口「加载中」集合的纯函数更新：start 加入，end 移除；永远返回新集合 */
export function updateLoading(prev: ReadonlySet<string>, stage: 'start' | 'end', id: string): ReadonlySet<string> {
  const next = new Set(prev)
  if (stage === 'start') next.add(id)
  else next.delete(id)
  return next
}

/** 某个 id 重新开始加载时清掉它上次的错误；没有错误时原样返回同一引用，避免无谓重渲染 */
export function clearError(prev: ReadonlyMap<string, string>, id: string): ReadonlyMap<string, string> {
  if (!prev.has(id)) return prev
  const next = new Map(prev)
  next.delete(id)
  return next
}
