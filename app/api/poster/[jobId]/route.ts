import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await params
  const job = await prisma.posterJob.findUnique({ where: { id: jobId } })

  if (!job) {
    return Response.json({ error: '任务不存在' }, { status: 404 })
  }

  return Response.json({
    status: job.status,
    resultImageUrl: job.resultImageUrl,
    errorMessage: job.errorMessage,
  })
}
