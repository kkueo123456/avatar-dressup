import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateManifest } from '@/data/manifest'

const file = fileURLToPath(new URL('../public/avatar/manifest.json', import.meta.url))

describe.skipIf(!existsSync(file))('真实 manifest.json', () => {
  it('通过校验，且每个服装槽位至少有一个部件', () => {
    const m = validateManifest(JSON.parse(readFileSync(file, 'utf8')))
    for (const slot of m.slots.filter((s) => s.outfit)) {
      expect(m.parts.some((p) => p.slot === slot.id), `槽位 ${slot.id} 没有部件`).toBe(true)
    }
  })
})
