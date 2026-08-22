// Dynamic sitemap.xml — indexed by Google, Bing, etc. Includes home + all public pages + /scan.
export const dynamic = 'force-static'

export default function sitemap() {
  const base = 'https://www.aurelawallet.com'
  const now = new Date().toISOString()
  const pages = [
    { url: base + '/',          priority: 1.0, changefreq: 'daily'  },
    { url: base + '/scan',      priority: 0.9, changefreq: 'always' },
  ]
  return pages.map(p => ({
    url: p.url,
    lastModified: now,
    changeFrequency: p.changefreq,
    priority: p.priority,
  }))
}
