import type { Metadata } from 'next'
import DressUp from '../../components/DressUp'

export const metadata: Metadata = { title: '换装台 · Avatar Dressup' }

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return <DressUp avatarId={id} />
}
