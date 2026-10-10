import { describe, expect, it } from 'vitest'
import { assetUrl } from '@/data/assetUrl'

describe('assetUrl', () => {
  it('默认前缀是同源 /avatar/', () => {
    expect(assetUrl('manifest.json')).toBe('/avatar/manifest.json')
  })

  it('基址带不带尾斜杠、路径带不带前导斜杠，拼出来都只有一个斜杠', () => {
    expect(assetUrl('/models/a.glb', 'https://cdn.example.com/avatar')).toBe('https://cdn.example.com/avatar/models/a.glb')
    expect(assetUrl('models/a.glb', 'https://cdn.example.com/avatar/')).toBe('https://cdn.example.com/avatar/models/a.glb')
    expect(assetUrl('//models/a.glb', '/avatar/')).toBe('/avatar/models/a.glb')
  })
})
