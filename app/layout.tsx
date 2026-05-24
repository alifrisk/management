import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="ru">
      <body className="antialiased bg-[#F5F8F6] min-h-screen">
        {children}
      </body>
    </html>
  )
}
