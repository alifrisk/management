'use client'
import { I18nProvider } from '@/lib/i18n'
import { SessionTimeout } from '@/components/SessionTimeout'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SessionTimeout />
      {children}
    </I18nProvider>
  )
}
