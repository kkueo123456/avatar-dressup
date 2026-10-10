import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'

const orbitron = localFont({
  src: './fonts/orbitron-subset.woff2',
  weight: '600 700',
  variable: '--font-orbitron',
  display: 'swap',
})

const huangyou = localFont({
  src: './fonts/huangyou-subset.woff2',
  weight: '400',
  variable: '--font-huangyou',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Avatar Dressup',
  description: '在浏览器里实时换装，再让 AI 画成海报',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={`${orbitron.variable} ${huangyou.variable}`}>
      <body>{children}</body>
    </html>
  )
}
