export interface SaveRecord {
  id: string
  name: string
  /** ISO 时间 */
  createdAt: string
  manifestVersion: number
  baseId: string
  /** slotId -> partId[] */
  parts: Record<string, string[]>
  /** data:image/jpeg;base64,… */
  thumbnail: string
}
