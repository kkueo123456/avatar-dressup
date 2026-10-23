import sharp from 'sharp'
import { type PosterInput, type PosterProvider, type PosterStyle } from './types'

/**
 * 通义万相「通用图像编辑」真实适配器。
 *
 * 走 DashScope 标准异步接口：
 *   1. POST 提交任务（X-DashScope-Async: enable）→ 拿 task_id
 *   2. GET 轮询任务，直到 SUCCEEDED / FAILED → 拿结果图 URL
 *   3. 下载结果图字节返回（结果 URL 24 小时有效，必须及时转存）
 *
 * 本项目 worker 本身就是异步轮询消费者，这里在 generate() 内部再做一层
 * 「提交→轮询→取回」的同步等待，两层异步对齐，worker 代码无需改动。
 *
 * 配置（环境变量）：
 *   POSTER_PROVIDER=real
 *   DASHSCOPE_API_KEY=sk-xxx   （阿里云百炼 / DashScope API Key）
 *
 * 价格：约 $0.02/张（图像编辑，北京地域），仅成功出图计费。
 *
 * 已实测（2026-10-23）：标准 DashScope 端点连通，提交→轮询→SUCCEEDED 全链路通过。
 * 万相约束：输入图宽/高须在 512~4096 像素之间，且不接受自定义 size 参数（按输入比例出图）。
 */

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com/api/v1'
const MODEL = 'wanx2.1-imageedit'

/** 万相输入图最小边长（px）；小于此值需先放大，否则报 InvalidParameter */
const MIN_INPUT_SIDE = 512

/** 提交任务后的轮询间隔（ms）与最大等待时长 */
const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 120_000

/** 四种海报风格 → 万相「全局风格化」的 prompt 文案 */
const STYLE_PROMPTS: Record<PosterStyle, string> = {
  fantasy: '转换成奇幻史诗插画风格，暖金色调，电影级光影，细节精致',
  anime: '转换成日式动漫风格，明亮清新的赛璐璐上色，线条干净',
  watercolor: '转换成清新水彩画风格，柔和晕染，纸纹质感，淡雅配色',
  cyberpunk: '转换成赛博朋克风格，霓虹蓝紫色调，高对比，未来感十足',
}

interface SubmitResponse {
  output?: { task_id?: string; task_status?: string }
  message?: string
  code?: string
}

interface TaskResponse {
  output?: {
    task_status?: string
    results?: Array<{ url?: string }>
  }
  message?: string
  code?: string
}

async function postJson<T>(url: string, body: unknown, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as T
  if (!res.ok) {
    const msg = (json as { message?: string }).message || `HTTP ${res.status}`
    throw new Error(`万相提交任务失败: ${msg}`)
  }
  return json
}

async function getJson<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const json = (await res.json().catch(() => ({}))) as T
  if (!res.ok) {
    const msg = (json as { message?: string }).message || `HTTP ${res.status}`
    throw new Error(`万相查询任务失败: ${msg}`)
  }
  return json
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const wanxProvider: PosterProvider = {
  id: 'real',

  async generate(input: PosterInput): Promise<Buffer> {
    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      throw new Error('缺少 DASHSCOPE_API_KEY，请在环境变量中配置阿里云百炼 API Key')
    }

    // 0. 输入图合规化：万相要求宽/高 512~4096px，过小则按比例放大
    let imageBuf = input.image
    const meta = await sharp(imageBuf, { limitInputPixels: 4096 * 4096 }).metadata()
    if ((meta.width ?? 0) < MIN_INPUT_SIDE || (meta.height ?? 0) < MIN_INPUT_SIDE) {
      const scale = MIN_INPUT_SIDE / Math.min(meta.width ?? 1, meta.height ?? 1)
      imageBuf = await sharp(imageBuf)
        .resize({ width: Math.round((meta.width ?? 512) * scale), height: Math.round((meta.height ?? 512) * scale) })
        .jpeg({ quality: 90 })
        .toBuffer()
    }

    // 1. 提交异步编辑任务（风格化：整图风格迁移）
    const submitUrl = `${DASHSCOPE_BASE}/services/aigc/image2image/image-synthesis`
    const submit = await postJson<SubmitResponse>(
      submitUrl,
      {
        model: MODEL,
        input: {
          function: 'stylization_all',
          prompt: STYLE_PROMPTS[input.style],
          base_image_url: `data:image/jpeg;base64,${imageBuf.toString('base64')}`,
        },
        parameters: {
          n: 1,
        },
      },
      apiKey,
    )

    const taskId = submit.output?.task_id
    if (!taskId) {
      throw new Error(`万相未返回 task_id: ${JSON.stringify(submit)}`)
    }

    // 2. 轮询任务直到完成
    const queryUrl = `${DASHSCOPE_BASE}/tasks/${taskId}`
    const deadline = Date.now() + MAX_WAIT_MS
    let resultUrl: string | undefined

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)
      const task = await getJson<TaskResponse>(queryUrl, apiKey)
      const status = task.output?.task_status

      if (status === 'SUCCEEDED') {
        resultUrl = task.output?.results?.[0]?.url
        break
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`万相生成失败: ${task.message || status}`)
      }
      // PENDING / RUNNING 继续轮询
    }

    if (!resultUrl) {
      throw new Error('万相生成超时（未在限定时间内完成）')
    }

    // 3. 下载结果图（结果 URL 24 小时有效，必须转存到本地）
    const imgRes = await fetch(resultUrl)
    if (!imgRes.ok) {
      throw new Error(`下载万相结果图失败: HTTP ${imgRes.status}`)
    }
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return buf
  },
}
