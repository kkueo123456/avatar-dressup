/**
 * parts 字段服务端校验。
 *
 * parts 的合法结构是 Record<slotId, partId[]>（见 AvatarState.equipped）。
 * 历史上 POST /api/avatar 对 parts 零校验，任意 JSON 都能入库
 * （如字符串、嵌套对象、数字数组），导致 DB 脏数据与前端未定义行为。
 * 现在写入路径（POST / PATCH）一律先过 validateParts，非法直接 400。
 *
 * 读取路径（GET）的 safeParseParts 容错解析保留——用于消化历史脏数据，
 * 坏数据返回空装备而不是 500。
 */

/** 校验并规范化 parts；合法返回规范化后的对象，非法返回 null */
export function validateParts(input: unknown): Record<string, string[]> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const result: Record<string, string[]> = {}
  const MAX_SLOTS = 64 // 槽位数量上限（manifest 实际 < 20，宽松留量）
  const MAX_IDS_PER_SLOT = 32 // 单槽位部件数上限（多选槽位实际 < 10）
  const MAX_ID_LENGTH = 128 // partId/slotId 字符长度上限

  const entries = Object.entries(input as Record<string, unknown>)
  if (entries.length > MAX_SLOTS) return null

  for (const [slotId, value] of entries) {
    if (!slotId || typeof slotId !== 'string' || slotId.length > MAX_ID_LENGTH) return null
    if (!Array.isArray(value) || value.length > MAX_IDS_PER_SLOT) return null
    for (const id of value) {
      if (typeof id !== 'string' || !id || id.length > MAX_ID_LENGTH) return null
    }
    // 规范化：去重（保持顺序）
    result[slotId] = [...new Set(value as string[])]
  }
  return result
}
