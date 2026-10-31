'use client'

import { useState } from 'react'
import { AurelaLogo } from './Logo'
import { Eye, EyeOff, Snowflake, MapPin } from 'lucide-react'

// Metallic colour themes per zone. Each theme is a brushed-metal duotone: `a` (lit edge) → `b` (deep shadow),
// an `accent` for the zone badge / landmark caption and a `foil` tone for the bevelled border.
export const ZONE_THEMES = {
  steel:    { a: '#44566d', b: '#0a0e14', accent: '#a9c0d8', foil: '#d6e2ee', label: 'Steel blue' },
  emerald:  { a: '#135238', b: '#04110b', accent: '#6fe0ad', foil: '#c3f3dc', label: 'Emerald' },
  sapphire: { a: '#223883', b: '#060a1f', accent: '#8aa8ff', foil: '#d1dbff', label: 'Sapphire' },
  crimson:  { a: '#6e1420', b: '#140307', accent: '#ff7b88', foil: '#ffd0d5', label: 'Crimson' },
  desert:   { a: '#7d5a1f', b: '#180f05', accent: '#f5cf74', foil: '#ffedbd', label: 'Desert gold' },
  bronze:   { a: '#5a3818', b: '#100803', accent: '#e0a06a', foil: '#f4d2ad', label: 'Bronze' },
  ruby:     { a: '#5c1238', b: '#10040b', accent: '#ff8cc3', foil: '#ffcde4', label: 'Ruby' },
  ivory:    { a: '#6b5a44', b: '#15100a', accent: '#f8ead0', foil: '#fff9ee', label: 'Ivory' },
  teal:     { a: '#0f5a60', b: '#031315', accent: '#6ce6ec', foil: '#c8f8fa', label: 'Teal' },
  obsidian: { a: '#33333d', b: '#040406', accent: '#ff5c5c', foil: '#dcdce4', label: 'Obsidian' },
  ocean:    { a: '#0f477a', b: '#020b17', accent: '#5fbcff', foil: '#c7e7ff', label: 'Ocean' },
}
export const ZONE_THEME_KEYS = Object.keys(ZONE_THEMES)

const ContactlessIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M6 8.5a6 6 0 0 1 0 7"/><path d="M9.5 6.5a9.5 9.5 0 0 1 0 11"/><path d="M13 4.5a13 13 0 0 1 0 15"/><path d="M16.5 2.5a16.5 16.5 0 0 1 0 19"/>
  </svg>
)

// EMV chip with a gold brushed finish
const Chip = () => (
  <div className="relative h-8 w-11 rounded-md overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_rgba(0,0,0,0.5)]"
       style={{ background: 'linear-gradient(135deg,#f7e7b0 0%,#d4af37 35%,#8a6a1a 60%,#e6cc7a 100%)' }}>
    <div className="absolute inset-x-0 top-1/2 h-px bg-black/35"/>
    <div className="absolute inset-y-0 left-1/3 w-px bg-black/35"/>
    <div className="absolute inset-y-0 right-1/3 w-px bg-black/35"/>
    <div className="absolute left-1/3 right-1/3 top-1/4 bottom-1/4 rounded-sm border border-black/35"/>
  </div>
)

/**
 * Metallic, landmark-themed virtual card.
 * Accepts either a card document (from /cards) or a zone config (for admin previews).
 * Props:
 *  - card: { zone, zone_name, landmark, landmark_city, theme, image_url, number, holder, expiry, cvv, frozen, status }
 *  - zone: { code, name, landmark, city, theme, image_url }   (used when card is absent — preview mode)
 *  - compact: smaller typography for grid previews
 *  - showCvvToggle: render the CVV reveal control (user cards only)
 */
export function ZonalCardVisual({ card, zone, compact = false, showCvvToggle = false, className = '' }) {
  const [showCvv, setShowCvv] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const z = {
    code: card?.zone || zone?.code || 'ZN',
    name: card?.zone_name || zone?.name || 'Zonal',
    landmark: card?.landmark || zone?.landmark || '',
    city: card?.landmark_city || zone?.city || '',
    theme: card?.theme || zone?.theme || 'steel',
    image_url: card?.image_url || zone?.image_url || '',
  }
  const t = ZONE_THEMES[z.theme] || ZONE_THEMES.steel
  const number = card?.number || '4260 •••• •••• ••••'
  const holder = card?.holder || 'AURELA MEMBER'
  const expiry = card?.expiry || '12/28'
  const cvv = card?.cvv || '•••'

  return (
    <div className={`relative rounded-2xl p-[1.5px] ${className}`}
         style={{ background: `linear-gradient(135deg, ${t.foil}cc 0%, ${t.a} 30%, #000 55%, ${t.foil}99 100%)`, boxShadow: '0 30px 70px -25px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)' }}
         data-testid={`zonal-card-${z.code}`}>
      <div className="relative rounded-[14px] overflow-hidden aspect-[16/10] text-white"
           style={{ background: `linear-gradient(140deg, ${t.a} 0%, ${t.b} 55%, ${t.a}66 100%)` }}>
        {/* Landmark photograph — bleeds in from the right under a metallic duotone */}
        {z.image_url && imgOk && (
          <img src={z.image_url} alt={z.landmark} onError={() => setImgOk(false)} loading="lazy"
               className="absolute inset-y-0 right-0 w-[72%] h-full object-cover select-none pointer-events-none"
               style={{ WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 45%, #000 100%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.85) 45%, #000 100%)', filter: 'grayscale(0.35) contrast(1.12) brightness(0.9)', opacity: 0.75 }}/>
        )}
        {/* Colour tint so the photo takes on the zone's metal */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, ${t.b} 0%, ${t.b}e6 28%, ${t.a}55 60%, ${t.b}88 100%)` }}/>
        {/* Brushed-metal grain */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.22]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 3px), repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 4px)' }}/>
        {/* Specular sheen sweep */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.16) 42%, rgba(255,255,255,0.04) 50%, transparent 62%)' }}/>
        {/* Top-left highlight + bottom vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.14) 0%, transparent 45%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 40%)' }}/>

        {/* Content */}
        <div className={`relative h-full flex flex-col justify-between ${compact ? 'p-3.5' : 'p-5'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <AurelaLogo size={compact ? 18 : 24} glow={false}/>
              <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-[0.3em] font-medium`} style={{ color: t.foil }}>Aurela</div>
            </div>
            <div className="text-right">
              <div className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-[0.35em]`} style={{ color: t.accent }}>Zone</div>
              <div className={`font-display ${compact ? 'text-base' : 'text-xl'} leading-none mt-0.5`} style={{ color: t.foil, textShadow: '0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(0,0,0,0.6)' }}>{z.code}</div>
            </div>
          </div>

          <div className={`flex items-center ${compact ? 'gap-2 mt-1' : 'gap-3 mt-2'}`}>
            <Chip/>
            <ContactlessIcon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} opacity-80`} />
            {/* Holographic seal */}
            <div className={`ml-auto ${compact ? 'h-4 w-4' : 'h-6 w-6'} rounded-full opacity-85`}
                 style={{ background: 'conic-gradient(from 180deg, #ffd6a5, #a5ffd6, #a5d6ff, #d6a5ff, #ffa5d6, #ffd6a5)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4), 0 0 10px rgba(255,255,255,0.25)', mixBlendMode: 'screen' }}/>
            <div className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase tracking-widest opacity-70`}>World</div>
          </div>

          <div className={`font-mono whitespace-nowrap overflow-hidden ${compact ? 'text-[12px] tracking-[0.1em]' : 'text-lg tracking-[0.18em]'}`} style={{ color: '#fff', textShadow: '0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.8)' }}>{number}</div>

          <div className={`flex items-end justify-between ${compact ? 'text-[9px]' : 'text-xs'}`}>
            <div className="min-w-0">
              <div className={`${compact ? 'text-[7px]' : 'text-[9px]'} uppercase tracking-widest opacity-60`}>Holder</div>
              <div className="truncate font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{holder}</div>
            </div>
            <div className="text-right">
              <div className={`${compact ? 'text-[7px]' : 'text-[9px]'} uppercase tracking-widest opacity-60`}>Exp</div>
              <div className="font-mono">{expiry}</div>
            </div>
            {showCvvToggle ? (
              <div className="text-right">
                <div className={`${compact ? 'text-[7px]' : 'text-[9px]'} uppercase tracking-widest opacity-60`}>CVV</div>
                <div className="font-mono flex items-center gap-1 justify-end">
                  {showCvv ? cvv : '•••'}
                  <button type="button" onClick={() => setShowCvv(v => !v)} className="opacity-80 hover:opacity-100" aria-label="Toggle CVV">
                    {showCvv ? <EyeOff className="h-3 w-3"/> : <Eye className="h-3 w-3"/>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-right">
                <div className={`${compact ? 'text-[7px]' : 'text-[9px]'} uppercase tracking-widest opacity-60`}>Region</div>
                <div className="font-medium" style={{ color: t.accent }}>{z.name}</div>
              </div>
            )}
          </div>

          {/* Landmark caption */}
          {z.landmark && (
            <div className={`absolute ${compact ? 'right-3.5 bottom-[38%] text-[8px]' : 'right-5 bottom-[40%] text-[10px]'} flex items-center gap-1 uppercase tracking-[0.25em]`} style={{ color: t.accent, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
              <MapPin className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'}/>
              <span>{z.landmark}{z.city ? ` · ${z.city}` : ''}</span>
            </div>
          )}
        </div>

        {card?.frozen && (
          <div className="absolute inset-0 bg-onyx-900/60 backdrop-blur-sm flex items-center justify-center">
            <Snowflake className="h-10 w-10 text-gold"/>
          </div>
        )}
      </div>
    </div>
  )
}

export default ZonalCardVisual
