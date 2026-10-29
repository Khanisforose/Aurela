'use client'

import { MapPin, MapPinOff, ExternalLink, Smartphone } from 'lucide-react'

// Compact admin-facing summary of a user's last known location (users.last_location) with optional history.
export function LocationSummary({ location, history = [], compact = false }) {
  if (!location) {
    return <div className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPinOff className="h-3.5 w-3.5"/> No location captured yet</div>
  }
  const denied = location.status === 'denied'
  const place = [location.city, location.state, location.country].filter(Boolean).join(', ')
  const ipPlace = location.ip_geo ? [location.ip_geo.city, location.ip_geo.country].filter(Boolean).join(', ') : null
  const maps = Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng)) ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : null
  const dev = location.device || {}
  const shortUa = (ua) => {
    if (!ua) return null
    const m = ua.match(/\((.*?)\)/)
    const os = m ? m[1].split(';')[0].trim() : ''
    const br = /Chrome\/(\d+)/.test(ua) ? `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}` : /Safari\//.test(ua) ? 'Safari' : /Firefox\/(\d+)/.test(ua) ? `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}` : ''
    return [os, br].filter(Boolean).join(' · ')
  }
  return (
    <div className={compact ? 'text-xs space-y-1' : 'text-xs space-y-1.5'}>
      <div className="flex items-start gap-2">
        {denied ? <MapPinOff className="h-4 w-4 text-red-400 shrink-0 mt-0.5"/> : <MapPin className="h-4 w-4 text-gold shrink-0 mt-0.5"/>}
        <div className="min-w-0 flex-1">
          {denied ? (
            <div className="text-red-400">Location permission denied{ipPlace ? <span className="text-muted-foreground"> · IP suggests {ipPlace}</span> : ''}</div>
          ) : (
            <div className="text-foreground">{place || 'Coordinates captured'}{location.accuracy_m ? <span className="text-muted-foreground"> · ±{location.accuracy_m} m</span> : ''}</div>
          )}
          <div className="text-muted-foreground break-all">
            {location.ip ? `IP ${location.ip}` : 'IP unknown'}{location.isp ? ` · ${location.isp}` : ''}{!denied && ipPlace && ipPlace !== place ? ` · IP location: ${ipPlace}` : ''}
          </div>
          {(dev.user_agent || dev.platform) && (
            <div className="text-muted-foreground flex items-center gap-1"><Smartphone className="h-3 w-3"/> {dev.platform || ''}{dev.platform && shortUa(dev.user_agent) ? ' · ' : ''}{shortUa(dev.user_agent)}{dev.standalone ? ' · installed app' : ''}{dev.timezone ? ` · ${dev.timezone}` : ''}</div>
          )}
          <div className="text-muted-foreground">{location.at ? new Date(location.at).toLocaleString() : ''}{location.updates > 1 ? ` · ${location.updates} updates` : ''}
            {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="ml-2 text-gold underline inline-flex items-center gap-0.5">Open in Maps <ExternalLink className="h-3 w-3"/></a>}
          </div>
        </div>
      </div>
      {!compact && Array.isArray(history) && history.length > 1 && (
        <div className="pt-2 border-t border-gold-500/10">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Recent sign-in locations</div>
          <div className="space-y-0.5">
            {history.slice(0, 6).map(h => (
              <div key={h.id} className="flex justify-between gap-3 text-[11px]">
                <span className={h.status === 'denied' ? 'text-red-400' : 'text-foreground/90'}>{h.status === 'denied' ? 'Denied' : [h.address?.city || h.ip_geo?.city, h.address?.country || h.ip_geo?.country].filter(Boolean).join(', ') || `${h.lat?.toFixed?.(3)}, ${h.lng?.toFixed?.(3)}`}</span>
                <span className="text-muted-foreground shrink-0">{h.ip || ''} · {new Date(h.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationSummary
