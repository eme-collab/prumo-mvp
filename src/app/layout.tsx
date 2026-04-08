import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import GlobalToast from '@/components/global-toast'
import PwaBootstrap from '@/components/pwa-bootstrap'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  applicationName: 'Prumo',
  title: {
    default: 'Prumo',
    template: '%s | Prumo',
  },
  description:
    'Registre vendas e despesas do seu negócio por voz, com revisão simples e foco total no celular.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Prumo',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    shortcut: '/favicon.ico',
    icon: [
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0284c7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-neutral-950">
        <PwaBootstrap />
        <Suspense fallback={null}>
          <GlobalToast />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
