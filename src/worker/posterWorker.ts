import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { getPosterProvider } from '@/poster/index'
import { parsePosterRequest } from '@/poster/request'

const prisma = new PrismaClient()
const provider = getPosterProvider()

/**
 * 海报文件存储目录：项目下 data/posters/（gitignore）。
 * DB 只存短路径（/posters/<文件名>），由 Web 进程的静态路由服务。
 * 单实例部署下 worker 与 Web 同机，直接共享本地磁盘。
 */
const POSTER_DIR = path.join(process.cwd(), 'data', 'posters')

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 写入海报文件，返回可存 DB 的短路径 */
function savePosterFile(buf: Buffer): string {
  fs.mkdirSync(POSTER_DIR, { recursive: true })
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
  fs.writeFileSync(path.join(POSTER_DIR, filename), buf)
  return `/posters/${filename}`
}

/** 兼容历史数据：旧任务的 resultImageUrl 是 data URL，转存为文件并更新 DB */
async function migrateDataUrlIfNeeded(jobId: string, dataUrl: string): Promise<string> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const shortPath = savePosterFile(Buffer.from(base64, 'base64'))
  await prisma.posterJob.update({
    where: { id: jobId },
    data: { resultImageUrl: shortPath },
  })
  return shortPath
}

async function run() {
  console.log('Worker 启动， provider =', provider.id)

  while (true) {
    // 1. 拉一条最早的 pending
    const job = await prisma.posterJob.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })

    if (!job) {
      await sleep(5000)
      continue
    }

    // 2. 原子抢锁：只有仍是 pending 才改成 running
    try {
      await prisma.posterJob.update({
        where: { id: job.id, status: 'pending' },
        data: { status: 'running', startedAt: new Date() },
      })
    } catch {
      // 被别的 worker 实例抢走，直接进入下一轮
      continue
    }

    console.log(`[${job.id}] 开始生成，style = ${job.style}`)

    // 3. 执行生成
    try {
      const parsed = parsePosterRequest({ image: job.inputImageUrl, style: job.style, prompt: job.prompt })
      if (!parsed.ok) {
        throw new Error(parsed.error)
      }

      const out = await provider.generate(parsed.input)

      // 结果写文件，DB 只存短路径（历史 data URL 自动迁移为文件）
      const raw = job.resultImageUrl
      const url = raw?.startsWith('data:')
        ? await migrateDataUrlIfNeeded(job.id, raw)
        : savePosterFile(out)

      await prisma.posterJob.update({
        where: { id: job.id },
        data: {
          status: 'done',
          resultImageUrl: url,
          finishedAt: new Date(),
        },
      })

      console.log(`[${job.id}] 完成 -> ${url}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[${job.id}] 失败: ${msg}`)

      await prisma.posterJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: msg,
          finishedAt: new Date(),
        },
      })
    }
  }
}

run().catch(async (e) => {
  console.error('Worker 崩溃:', e)
  await prisma.$disconnect()
  process.exit(1)
})
