import { PrismaClient } from '@prisma/client'
import { getPosterProvider } from '@/poster/index'
import { parsePosterRequest } from '@/poster/request'

const prisma = new PrismaClient()
const provider = getPosterProvider()

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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
      const parsed = parsePosterRequest({ image: job.inputImageUrl, style: job.style })
      if (!parsed.ok) {
        throw new Error(parsed.error)
      }

      const out = await provider.generate(parsed.input)

      // 本地 mock：把 Buffer 转成 base64 data URL 存回（真实环境应上传云存储）
      const url = `data:image/jpeg;base64,${out.toString('base64')}`

      await prisma.posterJob.update({
        where: { id: job.id },
        data: {
          status: 'done',
          resultImageUrl: url,
          finishedAt: new Date(),
        },
      })

      console.log(`[${job.id}] 完成`)
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
