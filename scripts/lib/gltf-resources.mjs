// 素材包里个别 .gltf 引用的贴图名和磁盘上的文件名差一个 "_png" 后缀
// （例如引用 T_Eye_Normal_png.png，实际是 T_Eye_Normal.png）。
// 这里只做纯计算：算出每个 uri 实际该读哪个文件，不碰磁盘、不往 assets-src 写副本。

const PNG_SUFFIX = /\.png$/i
const DUPLICATED_SUFFIX = /_png\.png$/i

/** 缺失 uri 的另一种候选命名；不是 png 时原样返回，调用方据此判断「没有可互换的名字」 */
export function alternativeUri(uri) {
  if (DUPLICATED_SUFFIX.test(uri)) return uri.replace(DUPLICATED_SUFFIX, '.png')
  return uri.replace(PNG_SUFFIX, '_png.png')
}

/** glTF 里需要从磁盘读的外部资源 uri：跳过内嵌 bufferView 与 data: */
export function externalUris(json) {
  return [...(json.images ?? []), ...(json.buffers ?? [])]
    .map((x) => x?.uri)
    .filter((u) => typeof u === 'string' && u.length > 0 && !u.startsWith('data:'))
}

/**
 * 给每个外部 uri 找出磁盘上真实存在的文件名。
 * @param {object} json glTF JSON
 * @param {(relPath: string) => boolean} exists 判断解码后的相对路径在素材目录里是否存在
 * @param {(uri: string) => string} [decode] uri 解码方式，默认 decodeURIComponent
 * @returns {{ entries: { uri: string, actualUri: string | null }[], repairs: { uri: string, from: string }[] }}
 *   entries 的顺序与 json 里出现的顺序一致，uri 保持原样（含百分号编码，供 resources 做 key），
 *   actualUri 为 null 表示两种命名都不存在；repairs 只装真正做了替换的那些。
 */
export function resolveGltfUris(json, exists, decode = decodeURIComponent) {
  const entries = []
  const repairs = []
  for (const uri of externalUris(json)) {
    if (exists(decode(uri))) {
      entries.push({ uri, actualUri: uri })
      continue
    }
    const alt = alternativeUri(uri)
    if (alt !== uri && exists(decode(alt))) {
      entries.push({ uri, actualUri: alt })
      repairs.push({ uri, from: alt })
      continue
    }
    entries.push({ uri, actualUri: null })
  }
  return { entries, repairs }
}
