'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/state/authStore'
import AuthDialog from './AuthDialog'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((s) => s.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <>
      {children}
      <AuthDialog />
    </>
  )
}
