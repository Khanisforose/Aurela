import ChainScan from './ChainScan.jsx'

export const metadata = {
  title: 'Aurela Chain Scan — Aurela Blockchain Explorer | Live Block Feed',
  description: 'Aurela Scan is the official public block explorer for the Aurela chain. Search Aurela blocks, wallet addresses (AUR IDs), transactions, deposits, withdrawals, swaps and card activations in real time.',
  keywords: ['aurela chain scan', 'aurela scan', 'aurela chain', 'aurela explorer', 'aurela block explorer', 'aurela chain search', 'aurela blockchain', 'AUR coin explorer', 'aurela wallet address', 'aurela transactions'],
  alternates: { canonical: 'https://www.aurelawallet.com/scan' },
  openGraph: {
    title: 'Aurela Chain Scan — Public Block Explorer',
    description: 'Explore the Aurela network in real time. Search blocks, addresses and transactions.',
    url: 'https://www.aurelawallet.com/scan',
    siteName: 'Aurela Scan',
    type: 'website',
    images: [{ url: 'https://www.aurelawallet.com/icons/icon-512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aurela Chain Scan',
    description: 'The official Aurela block explorer.',
    images: ['https://www.aurelawallet.com/icons/icon-512.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Aurela Chain Scan',
  alternateName: 'Aurela Scan',
  url: 'https://www.aurelawallet.com/scan',
  description: 'The official public block explorer for the Aurela chain. Search blocks, wallet addresses and transactions in real time.',
  publisher: {
    '@type': 'Organization',
    name: 'Aurela',
    url: 'https://www.aurelawallet.com',
    logo: { '@type': 'ImageObject', url: 'https://www.aurelawallet.com/icons/icon-512.png' }
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://www.aurelawallet.com/scan?q={search_term_string}' },
    'query-input': 'required name=search_term_string'
  }
}

export default function ChainScanPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ChainScan />
    </>
  )
}
