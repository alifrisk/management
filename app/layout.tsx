import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Risk Management System | Служба управления рисками',
  description: 'ОАО «Алиф Банк» — Платформа управления рисками Службы управления рисками',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('alif-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className="antialiased bg-[#F5F8F6] min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
