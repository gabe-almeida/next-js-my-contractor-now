import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'My Contractor Now - Get Instant Contractor Quotes',
  description: 'Connect with top-rated contractors in your area. Get instant quotes for roofing, windows, HVAC, and more home improvement projects.',
  keywords: 'contractors, home improvement, roofing, windows, HVAC, quotes',
  authors: [{ name: 'My Contractor Now' }],
  creator: 'My Contractor Now',
  publisher: 'My Contractor Now',
  robots: 'index, follow',
  icons: {
    icon: '/assets/favicon.png',
    shortcut: '/assets/favicon.png',
    apple: '/assets/favicon.png',
  },
  manifest: '/site.webmanifest',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: '#1d4ed8',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mycontractornow.com',
    siteName: 'My Contractor Now',
    title: 'My Contractor Now - Get Instant Contractor Quotes',
    description: 'Connect with top-rated contractors in your area. Get instant quotes for roofing, windows, HVAC, and more home improvement projects.',
    images: [
      {
        url: '/assets/My-Contractor-Now-Logo-Orange-Black.png',
        width: 1200,
        height: 630,
        alt: 'My Contractor Now Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Contractor Now - Get Instant Contractor Quotes',
    description: 'Connect with top-rated contractors in your area. Get instant quotes for roofing, windows, HVAC, and more home improvement projects.',
    images: ['/assets/My-Contractor-Now-Logo-Orange-Black.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ErrorBoundary>
          <div id="main-content" className="min-h-screen flex flex-col">
            {children}
          </div>
        </ErrorBoundary>
        <div id="portal-root" />
        <noscript>
          <div className="fixed inset-0 bg-yellow-50 border-l-4 border-yellow-400 p-4 z-50">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This website requires JavaScript to function properly. Please enable JavaScript in your browser settings.
                </p>
              </div>
            </div>
          </div>
        </noscript>
      </body>
    </html>
  )
}