import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
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

        {/*
          TrustedForm Web SDK - Must load on first page to capture full user journey
          Creates hidden field 'xxTrustedFormCertUrl' with certificate URL in all forms
          Docs: https://trustedform.com/documentation
        */}
        <Script
          id="trustedform-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var tf = document.createElement('script');
                tf.type = 'text/javascript';
                tf.async = true;
                tf.src = ("https:" == document.location.protocol ? 'https' : 'http') +
                  '://api.trustedform.com/trustedform.js?field=xxTrustedFormCertUrl&use_tagged_consent=true&l=' +
                  new Date().getTime() + Math.random();
                var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(tf, s);
                console.log('%c📋 TrustedForm: Script injected, waiting for certificate...', 'color: gray;');

                // Poll for TrustedForm certificate URL (SDK creates it asynchronously)
                var tfCheckCount = 0;
                var tfCheck = setInterval(function() {
                  tfCheckCount++;
                  // Check hidden input created by SDK
                  var input = document.querySelector('input[name="xxTrustedFormCertUrl"]');
                  if (input && input.value) {
                    console.log('%c✅ TrustedForm READY', 'color: green; font-weight: bold;');
                    console.log('%cTrustedForm Cert URL: ' + input.value, 'color: green;');
                    clearInterval(tfCheck);
                  } else if (tfCheckCount >= 20) {
                    console.log('%c⚠️ TrustedForm: Certificate not ready after 10s', 'color: orange;');
                    clearInterval(tfCheck);
                  }
                }, 500);
              })();
            `
          }}
        />

        {/*
          Jornaya LeadID Script - Must load on first page to track session
          Generates unique LeadID token for TCPA compliance
        */}
        <Script
          id="jornaya-script"
          strategy="afterInteractive"
          src="https://create.lidstatic.com/campaign/f9e0179a-baff-fd31-0b3d-43da231de245.js?snippet_version=2"
          onLoad={() => {
            console.log('%c📋 Jornaya: Script loaded, waiting for LeadID...', 'color: gray;');

            // Poll for Jornaya LeadID token
            let jrnCheckCount = 0;
            const jrnCheck = setInterval(() => {
              jrnCheckCount++;
              // Check multiple sources for LeadID
              const token = window.LeadiD?.token || window.LeadId?.getToken?.() || window.leadid_token;
              if (token) {
                console.log('%c✅ Jornaya LeadID READY', 'color: blue; font-weight: bold;');
                console.log('%cJornaya LeadID Token: ' + token, 'color: blue;');
                clearInterval(jrnCheck);
              } else if (jrnCheckCount >= 20) {
                console.log('%c⚠️ Jornaya: LeadID not ready after 10s', 'color: orange;');
                clearInterval(jrnCheck);
              }
            }, 500);
          }}
        />
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