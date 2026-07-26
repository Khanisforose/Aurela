'use client'

import { useApp } from './store'
import { AurelaLogo, AurelaWordmark } from './Logo'
import { Button } from '@/components/ui/button'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { HomePage } from './pages/HomePage'
import { FeaturesPage } from './pages/FeaturesPage'
import { CardsPage } from './pages/CardsPage'
import { ServicesPage } from './pages/ServicesPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { CompliancePage } from './pages/CompliancePage'

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'cards', label: 'Cards' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About Us' },
]

const FOOTER = [
  { id: 'terms', label: 'Terms' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'contact', label: 'Contact' },
]

export function Landing() {
  const { publicPage, setPublicPage, setRoute, setAuthMode } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)
  const goAuth = (mode) => { setAuthMode(mode); setRoute('auth') }
  const goPage = (id) => { setPublicPage(id); setMobileOpen(false); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <div className="relative min-h-screen bg-onyx-radial overflow-hidden text-foreground">
      <div className="absolute inset-0 grid-lines opacity-40 pointer-events-none"/>
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(212,175,55,0.14), transparent 70%)' }}/>

      {/* Header */}
      <header className="relative z-30 border-b border-gold-500/10 bg-onyx-950/60 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto flex items-center justify-between py-4">
          <button onClick={() => goPage('home')} className="cursor-pointer"><AurelaWordmark /></button>

          <nav className="hidden md:flex items-center gap-2 text-sm">
            {NAV.map(n => (
              <button key={n.id} onClick={() => goPage(n.id)}
                className={`px-4 py-2 rounded-full transition ${publicPage === n.id ? 'text-onyx-900 bg-gradient-to-r from-gold-200 via-gold-500 to-gold-700 font-semibold' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>
                {n.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" onClick={() => goAuth('login')} className="text-foreground hover:text-gold">Sign in</Button>
            <Button onClick={() => goAuth('register')} className="gold-btn rounded-full px-5">Open account <ArrowRight className="ml-2 h-4 w-4"/></Button>
          </div>

          <button className="md:hidden text-gold" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden border-t border-gold-500/10 bg-onyx-950/95 overflow-hidden">
              <div className="container mx-auto py-4 flex flex-col gap-2">
                {NAV.map(n => (
                  <button key={n.id} onClick={() => goPage(n.id)} className={`text-left px-4 py-2 rounded-lg ${publicPage === n.id ? 'gold-btn' : 'text-muted-foreground hover:text-gold hover:bg-gold-500/5'}`}>{n.label}</button>
                ))}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => goAuth('login')} className="flex-1 border-gold-500/40">Sign in</Button>
                  <Button onClick={() => goAuth('register')} className="gold-btn flex-1 rounded-full">Open account</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Page content */}
      <AnimatePresence mode="wait">
        <motion.main key={publicPage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }} className="relative z-10">
          {publicPage === 'home' && <HomePage goAuth={goAuth} goPage={goPage} />}
          {publicPage === 'features' && <FeaturesPage goAuth={goAuth} />}
          {publicPage === 'cards' && <CardsPage goAuth={goAuth} />}
          {publicPage === 'services' && <ServicesPage goAuth={goAuth} />}
          {publicPage === 'about' && <AboutPage goAuth={goAuth} />}
          {publicPage === 'contact' && <ContactPage />}
          {publicPage === 'terms' && <TermsPage />}
          {publicPage === 'privacy' && <PrivacyPage />}
          {publicPage === 'compliance' && <CompliancePage />}
        </motion.main>
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gold-500/10 mt-10 bg-onyx-950/60">
        <div className="container mx-auto py-14 grid md:grid-cols-4 gap-10">
          <div>
            <AurelaWordmark />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">The luxury standard in global finance. Multi-currency banking, crypto and virtual cards, redesigned.</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-gold mb-4">Platform</div>
            <div className="space-y-2 text-sm">
              {NAV.map(n => <button key={n.id} onClick={() => goPage(n.id)} className="block text-muted-foreground hover:text-gold">{n.label}</button>)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-gold mb-4">Legal</div>
            <div className="space-y-2 text-sm">
              {FOOTER.map(f => <button key={f.id} onClick={() => goPage(f.id)} className="block text-muted-foreground hover:text-gold">{f.label}</button>)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-gold mb-4">Get started</div>
            <div className="space-y-3">
              <Button onClick={() => goAuth('register')} className="gold-btn w-full rounded-full">Open account</Button>
              <Button onClick={() => goAuth('login')} variant="outline" className="w-full border-gold-500/40 rounded-full">Sign in</Button>
            </div>
          </div>
        </div>
        <div className="border-t border-gold-500/10">
          <div className="container mx-auto py-6 flex flex-col md:flex-row gap-3 justify-between text-xs text-muted-foreground">
            <div>© {new Date().getFullYear()} Aurela Wallet. All rights reserved.</div>
            <div>Wealth · Security · Trust</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Re-export CardVisual so other files continue to import from Landing
export { CardVisual } from './pages/HomePage'
