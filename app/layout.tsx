// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NavigationProvider } from '@/contexts/NavigationContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VisionPlus - Multi-Currency System',
  description: 'Enterprise optometry system for Zimbabwe clinics with multi-currency support',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Add Droid Sans font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Droid+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  )
}