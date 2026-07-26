'use client'

export function AurelaLogo({ size = 40, glow = true, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Aurela">
      <defs>
        <linearGradient id="aurelaGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5e29d"/>
          <stop offset="50%" stopColor="#d4af37"/>
          <stop offset="100%" stopColor="#8f6b18"/>
        </linearGradient>
        <linearGradient id="aurelaBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#141419"/>
          <stop offset="100%" stopColor="#050507"/>
        </linearGradient>
        {glow && (
          <filter id="aurelaGlow">
            <feGaussianBlur stdDeviation="1.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        )}
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#aurelaBg)" stroke="rgba(212,175,55,0.4)" strokeWidth="1"/>
      <g filter={glow ? 'url(#aurelaGlow)' : undefined}>
        <path d="M32 12 L50 52 L43 52 L38.5 42 L25.5 42 L21 52 L14 52 Z M28 36 L36 36 L32 22 Z" fill="url(#aurelaGold)"/>
        <circle cx="32" cy="56" r="1.5" fill="#f5e29d"/>
      </g>
    </svg>
  )
}

export function AurelaWordmark({ size = 28 }) {
  return (
    <div className="flex items-center gap-3">
      <AurelaLogo size={size} />
      <span className="font-display text-xl tracking-widest gold-text">AURELA</span>
    </div>
  )
}
