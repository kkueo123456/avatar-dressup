#!/usr/bin/env node
// 把 public/landing/src/*.jpg 缩成 480 乘 720 的 webp，写到 public/landing/。原图不进 git。
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'public', 'landing', 'src')
const OUT = path.join(ROOT, 'public', 'landing')

await mkdir(OUT, { recursive: true })
for (const f of await readdir(SRC)) {
  if (!/\.(jpe?g|png)$/i.test(f)) continue
  const out = path.join(OUT, f.replace(/\.(jpe?g|png)$/i, '.webp'))
  const info = await sharp(path.join(SRC, f)).resize(480, 720, { fit: 'cover' }).webp({ quality: 82 }).toFile(out)
  console.log(`${f} -> ${path.basename(out)} ${(info.size / 1024).toFixed(0)} KB`)
}
