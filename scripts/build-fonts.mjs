#!/usr/bin/env node
// 下载两款 OFL 许可的字体 TTF，按项目源码里实际出现的字符子集化为 woff2，写到 app/fonts/。
// 用法: node scripts/build-fonts.mjs    文案或 manifest 里的中文变了就重跑一次。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'
import subsetFont from 'subset-font'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'app', 'fonts')
// 走 jsDelivr 的 GitHub 镜像：raw.githubusercontent.com 在这台机器上经常断连
// 固定 commit，别用 @main，否则任何一次上游提交都会让同一份源码产出不同字体。
// 取新 commit：curl -H 'user-agent: x' https://api.github.com/repos/google/fonts/commits/main
const FONT_COMMIT = '66928797f271fed5ee428544e7229685e2d90127'
const GITHUB_FONTS = `https://cdn.jsdelivr.net/gh/google/fonts@${FONT_COMMIT}/ofl`

function ascii() {
  let s = ''
  for (let c = 0x20; c < 0x7f; c++) s += String.fromCharCode(c)
  return s
}

/** 扫描页面源码与 manifest 里出现过的中日韩字符与全角标点 */
async function cjkInSource() {
  const files = await fg(
    ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'public/avatar/manifest.json'],
    { cwd: ROOT, onlyFiles: true },
  )
  const chars = new Set('·，。：、！？（）「」…')
  for (const f of files) {
    const text = await readFile(path.join(ROOT, f), 'utf8')
    for (const ch of text) if (/[　-〿一-鿿＀-￯]/.test(ch)) chars.add(ch)
  }
  return [...chars].join('')
}

async function fetchBuffer(url, attempts = 3) {
  let lastError
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      lastError = e
      console.warn(`下载失败（第 ${i} 次）${url}: ${e instanceof Error ? e.message : e}`)
    }
  }
  throw new Error(`下载失败 ${url}: ${lastError instanceof Error ? lastError.message : lastError}`)
}

const cjk = await cjkInSource()
const FONTS = [
  {
    name: 'Orbitron',
    url: `${GITHUB_FONTS}/orbitron/Orbitron%5Bwght%5D.ttf`,
    out: 'orbitron-subset.woff2',
    text: ascii(),
    variationAxes: { wght: { min: 600, max: 700, default: 700 } },
  },
  {
    name: 'ZCOOL QingKe HuangYou',
    url: `${GITHUB_FONTS}/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf`,
    out: 'huangyou-subset.woff2',
    text: ascii() + cjk,
    variationAxes: undefined,
  },
]

await mkdir(OUT, { recursive: true })
for (const f of FONTS) {
  const ttf = await fetchBuffer(f.url)
  const woff2 = await subsetFont(ttf, f.text, { targetFormat: 'woff2', variationAxes: f.variationAxes })
  await writeFile(path.join(OUT, f.out), woff2)
  console.log(`${f.name}: ${f.text.length} 个字符 -> app/fonts/${f.out} ${(woff2.length / 1024).toFixed(0)} KB`)
}
