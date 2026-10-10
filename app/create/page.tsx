import type { Metadata } from 'next'
import DressUp from '../../components/DressUp'

export const metadata: Metadata = { title: '换装台 · Avatar Dressup' }

export default function CreatePage() {
  return <DressUp />
}
