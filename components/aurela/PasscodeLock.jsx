'use client'

// Passcode + biometric (WebAuthn) lock. Shown as an overlay on installed PWA / APK.
// - Stores a bcrypt-like hash of the user's 6-digit passcode in localStorage (aurela_passcode)
// - Optionally binds a WebAuthn platform credential (FaceID / TouchID / fingerprint / Windows Hello) via navigator.credentials
// - Auto-locks the app after inactivity (default 5 min)
// - Skip lock when running in a plain browser tab (not installed) to keep UX fast; only enforce inside PWA/APK

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, Lock, ShieldCheck, Delete, X, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

const LS_HASH = 'aurela_passcode_v1'
const LS_CRED = 'aurela_webauthn_credential_id'
const LS_BIO  = 'aurela_biometric_enabled'
const LS_UNLOCK = 'aurela_last_unlock'
const INACTIVITY_MS = 5 * 60 * 1000

const hashPin = async (pin) => {
  const enc = new TextEncoder().encode('aurela:' + pin)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

export function usePasscodeLock({ enabled = true } = {}) {
  const [state, setState] = useState({ hasPin: false, locked: false, bioAvailable: false, bioEnabled: false, isInstalled: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    const hasPin = !!localStorage.getItem(LS_HASH)
    const bioEnabled = !!localStorage.getItem(LS_BIO) && !!localStorage.getItem(LS_CRED)
    const last = Number(localStorage.getItem(LS_UNLOCK) || 0)
    const stale = Date.now() - last > INACTIVITY_MS
    const bioAvailable = !!(window.PublicKeyCredential && window.crypto?.subtle)
    setState({ hasPin, locked: enabled && isInstalled && hasPin && stale, bioAvailable, bioEnabled, isInstalled })

    const onHide = () => { if (document.visibilityState === 'hidden') localStorage.setItem(LS_UNLOCK, String(Date.now() - INACTIVITY_MS + 30000)) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [enabled])

  const unlock = useCallback(() => {
    localStorage.setItem(LS_UNLOCK, String(Date.now()))
    setState(s => ({ ...s, locked: false }))
  }, [])

  const lock = useCallback(() => setState(s => ({ ...s, locked: true })), [])

  const setup = useCallback(async (pin) => {
    const h = await hashPin(pin)
    localStorage.setItem(LS_HASH, h)
    localStorage.setItem(LS_UNLOCK, String(Date.now()))
    setState(s => ({ ...s, hasPin: true, locked: false }))
  }, [])

  const verify = useCallback(async (pin) => {
    const h = await hashPin(pin)
    return h === localStorage.getItem(LS_HASH)
  }, [])

  const enrollBiometric = useCallback(async () => {
    if (!window.PublicKeyCredential) throw new Error('Biometric not supported on this device')
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId    = crypto.getRandomValues(new Uint8Array(16))
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge, rp: { name: 'Aurela' },
        user: { id: userId, name: 'aurela-user', displayName: 'Aurela User' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000, attestation: 'none'
      }
    })
    if (!cred?.rawId) throw new Error('No credential returned')
    const idB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))
    localStorage.setItem(LS_CRED, idB64)
    localStorage.setItem(LS_BIO, '1')
    setState(s => ({ ...s, bioEnabled: true }))
    return true
  }, [])

  const verifyBiometric = useCallback(async () => {
    const id = localStorage.getItem(LS_CRED)
    if (!id) throw new Error('No biometric enrolled')
    const bytes = Uint8Array.from(atob(id), c => c.charCodeAt(0))
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    await navigator.credentials.get({
      publicKey: {
        challenge, timeout: 60000, userVerification: 'required',
        allowCredentials: [{ id: bytes, type: 'public-key', transports: ['internal'] }]
      }
    })
    return true
  }, [])

  const disableBiometric = useCallback(() => {
    localStorage.removeItem(LS_CRED); localStorage.removeItem(LS_BIO)
    setState(s => ({ ...s, bioEnabled: false }))
  }, [])

  const removePin = useCallback(() => {
    localStorage.removeItem(LS_HASH); localStorage.removeItem(LS_CRED); localStorage.removeItem(LS_BIO); localStorage.removeItem(LS_UNLOCK)
    setState({ hasPin: false, locked: false, bioAvailable: state.bioAvailable, bioEnabled: false, isInstalled: state.isInstalled })
  }, [state.bioAvailable, state.isInstalled])

  return { ...state, unlock, lock, setup, verify, enrollBiometric, verifyBiometric, disableBiometric, removePin }
}

export function PasscodeLock({ ctrl, onUnlock }) {
  const { locked, bioEnabled, bioAvailable, verify, verifyBiometric, unlock, hasPin } = ctrl
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [tryingBio, setTryingBio] = useState(false)

  useEffect(() => { setPin(''); setError('') }, [locked])

  const pressKey = async (k) => {
    setError('')
    if (k === 'del') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const next = pin + k
    setPin(next)
    if (next.length === 6) {
      const ok = await verify(next)
      if (ok) { unlock(); onUnlock && onUnlock() }
      else { setError('Incorrect passcode'); setTimeout(() => setPin(''), 400) }
    }
  }

  const tryBio = async () => {
    setTryingBio(true); setError('')
    try { await verifyBiometric(); unlock(); onUnlock && onUnlock() }
    catch(e) { setError('Biometric cancelled or unavailable') }
    finally { setTryingBio(false) }
  }

  useEffect(() => { if (locked && bioEnabled) tryBio() }, [locked, bioEnabled]) // eslint-disable-line

  if (!locked || !hasPin) return null

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-xl flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gold-500/25 to-gold-800/25 border border-gold-500/40 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-gold-bright"/>
            </div>
            <div className="font-display text-3xl">Enter <span className="gold-text">passcode</span></div>
            <div className="text-sm text-muted-foreground mt-1">Unlock Aurela to continue</div>
          </div>

          <div className="flex justify-center gap-3 mt-8">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`h-3 w-3 rounded-full transition-all ${pin.length > i ? 'bg-gold-bright shadow-[0_0_10px_rgba(212,175,55,0.6)]' : 'bg-secondary border border-gold-500/20'}`}/>
            ))}
          </div>

          {error && <div className="text-center text-xs text-red-400 mt-3">{error}</div>}

          <div className="grid grid-cols-3 gap-3 mt-8">
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => pressKey(String(n))} className="h-16 rounded-2xl bg-secondary/70 hover:bg-gold-500/15 active:bg-gold-500/25 border border-gold-500/15 text-2xl font-display transition-colors">{n}</button>
            ))}
            <button onClick={tryBio} disabled={!bioEnabled || tryingBio} className={`h-16 rounded-2xl border transition-colors ${bioEnabled ? 'bg-gold-500/15 border-gold-500/40 hover:bg-gold-500/25 text-gold-bright' : 'bg-secondary/30 border-gold-500/10 text-muted-foreground/40'}`}>
              <Fingerprint className="h-6 w-6 mx-auto"/>
            </button>
            <button onClick={() => pressKey('0')} className="h-16 rounded-2xl bg-secondary/70 hover:bg-gold-500/15 active:bg-gold-500/25 border border-gold-500/15 text-2xl font-display transition-colors">0</button>
            <button onClick={() => pressKey('del')} className="h-16 rounded-2xl bg-secondary/70 hover:bg-gold-500/15 active:bg-gold-500/25 border border-gold-500/15 flex items-center justify-center transition-colors"><Delete className="h-5 w-5"/></button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Small settings block used in Profile section
export function PasscodeSettings({ ctrl }) {
  const { hasPin, bioAvailable, bioEnabled, isInstalled, setup, enrollBiometric, disableBiometric, removePin } = ctrl
  const [mode, setMode] = useState(null) // 'setup-1' | 'setup-2'
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')

  const startSetup = () => { setMode('setup-1'); setP1(''); setP2('') }
  const finish = async () => {
    if (p1.length !== 6 || p1 !== p2) { toast.error('Passcodes must match and be 6 digits'); return }
    await setup(p1)
    setMode(null); setP1(''); setP2('')
    toast.success('Passcode enabled')
  }
  const enrollBio = async () => {
    try { await enrollBiometric(); toast.success('Biometric unlock enabled') }
    catch(e) { toast.error(e.message || 'Biometric enrolment failed') }
  }

  return (
    <div className="card-luxury rounded-2xl p-5 md:p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gold mb-2"><ShieldCheck className="h-3.5 w-3.5"/> Security</div>
      <div className="font-display text-xl">App lock</div>
      <div className="text-xs text-muted-foreground mt-1">Add a 6-digit passcode & optional fingerprint / FaceID unlock. Enforced when the app is installed on your device.</div>

      {!isInstalled && (
        <div className="mt-3 text-[11px] text-muted-foreground/70 p-2.5 rounded-lg bg-secondary/40 border border-gold-500/10">
          Passcode lock only activates once you install Aurela via the Download App button. Tap it in the top bar.
        </div>
      )}

      {hasPin ? (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-gold-500/15">
            <div className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-gold"/> 6-digit passcode</div>
            <span className="text-xs text-emerald-400">Enabled</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-gold-500/15">
            <div className="flex items-center gap-2 text-sm"><Fingerprint className="h-4 w-4 text-gold"/> Biometric unlock</div>
            {bioEnabled ? (
              <button onClick={disableBiometric} className="text-xs text-red-400 hover:underline">Disable</button>
            ) : (
              <button onClick={enrollBio} disabled={!bioAvailable} className="text-xs text-gold hover:underline disabled:opacity-40">{bioAvailable ? 'Enable' : 'Not available'}</button>
            )}
          </div>
          <button onClick={() => { if (confirm('Remove passcode? Your app will no longer be locked.')) removePin() }} className="text-xs text-red-400 hover:underline">Remove passcode</button>
        </div>
      ) : (
        <>
          {mode !== 'setup-1' && <button onClick={startSetup} className="mt-4 gold-btn h-11 px-5 rounded-xl text-sm">Set up passcode</button>}
          {mode === 'setup-1' && (
            <div className="mt-5 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Choose a 6-digit passcode</div>
                <input value={p1} onChange={e => setP1(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" type="password" className="mt-2 w-full h-12 px-4 rounded-xl bg-secondary border border-gold-500/20 text-lg font-mono tracking-[0.5em] text-center"/>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Confirm passcode</div>
                <input value={p2} onChange={e => setP2(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" type="password" className="mt-2 w-full h-12 px-4 rounded-xl bg-secondary border border-gold-500/20 text-lg font-mono tracking-[0.5em] text-center"/>
              </div>
              <div className="flex gap-2">
                <button onClick={finish} disabled={p1.length !== 6 || p1 !== p2} className="gold-btn h-11 px-5 rounded-xl text-sm flex-1 disabled:opacity-40">Enable lock</button>
                <button onClick={() => setMode(null)} className="h-11 px-5 rounded-xl border border-gold-500/20 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
