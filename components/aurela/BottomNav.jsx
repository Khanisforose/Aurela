'use client'

import { Home, ArrowLeftRight, Repeat, CreditCard, User } from 'lucide-react'

// Binance-style bottom tab bar for mobile (visible under md breakpoint only).
// tabs: [ { id, label, icon } ]
export function BottomNav({ tab, setTab, tabs }) {
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-xl border-t border-gold-500/25 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center py-2.5 px-1 relative transition-colors ${active ? 'text-gold-bright' : 'text-muted-foreground'}`}
            >
              {active && <div className="absolute top-0 h-0.5 w-8 rounded-b bg-gradient-to-r from-transparent via-gold to-transparent"/>}
              <div className={`h-6 w-6 flex items-center justify-center transition-transform ${active ? 'scale-110' : ''}`}>
                <Icon className="h-5 w-5"/>
              </div>
              <div className="text-[10px] mt-0.5 font-medium tracking-wide">{t.label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const MOBILE_TABS = [
  { id: 'overview',     label: 'Home',    icon: Home },
  { id: 'wallets',      label: 'Wallets', icon: Repeat },
  { id: 'swap',         label: 'Swap',    icon: ArrowLeftRight },
  { id: 'cards',        label: 'Cards',   icon: CreditCard },
  { id: 'profile',      label: 'Me',      icon: User },
]
