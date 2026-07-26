import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Aurela — Global Digital Banking & Crypto',
  description: 'A luxury global fintech: multi-currency banking, crypto wallets, virtual cards, instant transfers. Wealth. Security. Trust.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ]
  },
  openGraph: {
    title: 'Aurela — Global Digital Banking & Crypto',
    description: 'Luxury multi-currency banking and cryptocurrency for a global life.',
    siteName: 'Aurela',
    type: 'website'
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0a0a0e" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
