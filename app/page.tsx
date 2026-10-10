import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1 className="font-display">Avatar Dressup</h1>
      <p>首页建设中。</p>
      <Link href="/create" className="btn-primary">开始创建</Link>
    </main>
  )
}
