import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['avaup.online', 'www.avaup.online', 'localhost:3000'],
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
