import { describe, expect, it } from 'vitest'
import { alternativeUri, externalUris, resolveGltfUris } from '../scripts/lib/gltf-resources.mjs'

/** 用内存里的文件名集合充当磁盘 */
function fsOf(...files) {
  const set = new Set(files)
  return (rel) => set.has(rel)
}

describe('alternativeUri', () => {
  it('_png.png 换成 .png', () => {
    expect(alternativeUri('T_Eye_Normal_png.png')).toBe('T_Eye_Normal.png')
  })
  it('.png 换成 _png.png', () => {
    expect(alternativeUri('T_Eye_Normal.png')).toBe('T_Eye_Normal_png.png')
  })
  it('不是 png 时原样返回', () => {
    expect(alternativeUri('scene.bin')).toBe('scene.bin')
  })
})

describe('externalUris', () => {
  it('images 在前 buffers 在后，跳过 data: 与没有 uri 的项', () => {
    const json = {
      images: [{ uri: 'a.png' }, { uri: 'data:image/png;base64,AAAA' }, { bufferView: 0 }],
      buffers: [{ uri: 'b.bin' }],
    }
    expect(externalUris(json)).toEqual(['a.png', 'b.bin'])
  })
  it('没有 images 与 buffers 时返回空数组', () => {
    expect(externalUris({})).toEqual([])
  })
})

describe('resolveGltfUris', () => {
  it('原名存在时不改动', () => {
    const json = { images: [{ uri: 'T_Eye_Normal.png' }] }
    const { entries, repairs } = resolveGltfUris(json, fsOf('T_Eye_Normal.png'))
    expect(entries).toEqual([{ uri: 'T_Eye_Normal.png', actualUri: 'T_Eye_Normal.png' }])
    expect(repairs).toEqual([])
  })

  it('引用多一个 _png 后缀时指到磁盘上的 .png', () => {
    const json = { images: [{ uri: 'T_Eye_Normal_png.png' }], buffers: [{ uri: 'scene.bin' }] }
    const { entries, repairs } = resolveGltfUris(json, fsOf('T_Eye_Normal.png', 'scene.bin'))
    expect(entries).toEqual([
      { uri: 'T_Eye_Normal_png.png', actualUri: 'T_Eye_Normal.png' },
      { uri: 'scene.bin', actualUri: 'scene.bin' },
    ])
    expect(repairs).toEqual([{ uri: 'T_Eye_Normal_png.png', from: 'T_Eye_Normal.png' }])
  })

  it('引用少一个 _png 后缀时反向指回磁盘上的 _png.png', () => {
    const json = { images: [{ uri: 'T_Eye_Normal.png' }] }
    const { entries, repairs } = resolveGltfUris(json, fsOf('T_Eye_Normal_png.png'))
    expect(entries).toEqual([{ uri: 'T_Eye_Normal.png', actualUri: 'T_Eye_Normal_png.png' }])
    expect(repairs).toEqual([{ uri: 'T_Eye_Normal.png', from: 'T_Eye_Normal_png.png' }])
  })

  it('两种命名都不存在时 actualUri 为 null，不产生修复记录', () => {
    const json = { images: [{ uri: 'T_Missing.png' }] }
    const { entries, repairs } = resolveGltfUris(json, fsOf('T_Other.png'))
    expect(entries).toEqual([{ uri: 'T_Missing.png', actualUri: null }])
    expect(repairs).toEqual([])
  })

  it('非 png 的外部资源缺失时不做后缀互换', () => {
    const json = { buffers: [{ uri: 'scene.bin' }] }
    const { entries, repairs } = resolveGltfUris(json, fsOf('scene_png.bin'))
    expect(entries).toEqual([{ uri: 'scene.bin', actualUri: null }])
    expect(repairs).toEqual([])
  })

  it('uri 带百分号编码时按解码后的路径查磁盘，entries 保留原样编码的 uri 与 actualUri', () => {
    const json = { images: [{ uri: 'T_Hand%20Sword_png.png' }] }
    const seen = []
    const { entries } = resolveGltfUris(json, (rel) => {
      seen.push(rel)
      return rel === 'T_Hand Sword.png'
    })
    expect(seen).toEqual(['T_Hand Sword_png.png', 'T_Hand Sword.png'])
    expect(entries).toEqual([{ uri: 'T_Hand%20Sword_png.png', actualUri: 'T_Hand%20Sword.png' }])
  })

  it('data: 与内嵌 bufferView 不参与解析', () => {
    const json = { images: [{ uri: 'data:image/png;base64,AAAA' }, { bufferView: 1 }], buffers: [] }
    const { entries } = resolveGltfUris(json, () => false)
    expect(entries).toEqual([])
  })
})
