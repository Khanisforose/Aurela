'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Camera, RotateCcw, Check, Loader2, Sun, ShieldCheck, AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, Smile, Eye, ZoomIn, ScanFace } from 'lucide-react'
import { LIVENESS_POOL, challengeLabel } from './forceKycShared'

const ICONS = { center: ScanFace, left: ArrowLeft, right: ArrowRight, up: ArrowUp, smile: Smile, blink: Eye, closer: ZoomIn }
const PREP_MS = 1100
const HOLD_MS = 2800
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]] } return x }

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) { try { if (MediaRecorder.isTypeSupported(m)) return m } catch (e) {} }
  return ''
}

// Guided in-app liveness check: random head-movement challenges, frame captures per challenge + full session video.
// onComplete({ videoBlob, frames:[{challenge, blob, at}], challenges, started_at, completed_at, duration_ms, face_signals })
export function LivenessCheck({ onComplete, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const abortRef = useRef(false)
  const [state, setState] = useState('idle')  // idle | starting | ready | running | processing | review | error
  const [err, setErr] = useState('')
  const [light, setLight] = useState(null)    // 0..255 average luminance
  const [steps, setSteps] = useState([])
  const [stepIdx, setStepIdx] = useState(0)
  const [phase, setPhase] = useState('prep')  // prep | hold | done
  const [holdPct, setHoldPct] = useState(0)
  const [result, setResult] = useState(null)
  const [previews, setPreviews] = useState({ frames: [], video: null })

  const stopCamera = () => { try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch (e) {} streamRef.current = null }
  useEffect(() => () => { abortRef.current = true; stopCamera(); try { recRef.current?.state === 'recording' && recRef.current.stop() } catch (e) {} }, [])
  useEffect(() => () => { previews.frames.forEach(u => URL.revokeObjectURL(u)); previews.video && URL.revokeObjectURL(previews.video) }, [previews])

  const startCamera = async () => {
    setErr(''); setState('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Camera not supported on this browser'), { name: 'NotSupported' })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      streamRef.current = stream
      const v = videoRef.current
      if (v) { v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play().catch(() => {}) }
      setState('ready')
    } catch (e) {
      setErr(e?.name === 'NotAllowedError' ? 'Camera access was blocked. Allow camera access for Aurela in your browser or phone settings, then try again.' : e?.name === 'NotFoundError' ? 'No front camera was found on this device.' : (e?.message || 'Could not start the camera'))
      setState('error')
    }
  }

  // Lighting monitor while waiting to start
  useEffect(() => {
    if (state !== 'ready') return
    const c = document.createElement('canvas'); c.width = 32; c.height = 24
    const ctx = c.getContext('2d', { willReadFrequently: true })
    const id = setInterval(() => {
      const v = videoRef.current; if (!v || !v.videoWidth) return
      ctx.drawImage(v, 0, 0, 32, 24)
      const d = ctx.getImageData(0, 0, 32, 24).data
      let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      setLight(s / (d.length / 4))
    }, 500)
    return () => clearInterval(id)
  }, [state])

  const grabFrame = () => new Promise((res) => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return res(null)
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(b => res(b), 'image/jpeg', 0.86)
  })

  const run = async () => {
    abortRef.current = false
    const seq = ['center', ...shuffle(LIVENESS_POOL.map(c => c.id)).slice(0, 4)]
    setSteps(seq); setStepIdx(0); setState('running')
    const started = Date.now()
    // Record the whole session
    const mime = pickRecorderMime()
    chunksRef.current = []
    let rec = null
    if (mime !== null && streamRef.current) {
      try {
        rec = new MediaRecorder(streamRef.current, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 700_000 })
        rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
        rec.start(500); recRef.current = rec
      } catch (e) { rec = null }
    }
    const frames = []
    for (let i = 0; i < seq.length; i++) {
      if (abortRef.current) return
      setStepIdx(i); setPhase('prep'); setHoldPct(0)
      await sleep(PREP_MS)
      setPhase('hold')
      const t0 = Date.now(); let captured = false
      while (Date.now() - t0 < HOLD_MS) {
        if (abortRef.current) return
        const p = (Date.now() - t0) / HOLD_MS
        setHoldPct(Math.min(100, p * 100))
        if (!captured && p >= 0.62) { captured = true; const b = await grabFrame(); if (b) frames.push({ challenge: seq[i], blob: b, at: new Date().toISOString() }) }
        await sleep(60)
      }
      setHoldPct(100); setPhase('done'); await sleep(260)
    }
    setState('processing')
    let videoBlob = null
    if (rec) {
      await new Promise(res => { rec.onstop = res; try { rec.stop() } catch (e) { res() } })
      if (chunksRef.current.length) videoBlob = new Blob(chunksRef.current, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] })
    }
    // Best-effort on-device face signal (Chromium FaceDetector); admins still review manually
    let face_signals = { api: 'none' }
    try {
      if (typeof window !== 'undefined' && 'FaceDetector' in window) {
        const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
        let withFace = 0, multi = 0
        for (const f of frames) { const bmp = await createImageBitmap(f.blob); const faces = await fd.detect(bmp); if (faces.length) withFace++; if (faces.length > 1) multi++ }
        face_signals = { api: 'FaceDetector', frames: frames.length, frames_with_face: withFace, frames_multi_face: multi }
      }
    } catch (e) {}
    const r = { videoBlob, frames, challenges: seq, started_at: new Date(started).toISOString(), completed_at: new Date().toISOString(), duration_ms: Date.now() - started, face_signals }
    setResult(r)
    setPreviews({ frames: frames.map(f => URL.createObjectURL(f.blob)), video: videoBlob ? URL.createObjectURL(videoBlob) : null })
    stopCamera()
    setState('review')
  }

  const retake = async () => { setResult(null); setPreviews({ frames: [], video: null }); setLight(null); await startCamera() }

  const cur = steps[stepIdx]
  const CurIcon = ICONS[cur] || ScanFace
  const curText = cur === 'center' ? 'Look straight at the camera' : LIVENESS_POOL.find(c => c.id === cur)?.text
  const lightOk = light == null ? null : light > 70 && light < 235
  const showCam = ['starting', 'ready', 'running', 'processing'].includes(state)

  return (
    <div className="space-y-4" data-testid="liveness-check">
      {/* Camera stage */}
      <div className={`relative mx-auto w-full max-w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden bg-onyx-950 ring-1 ring-gold-500/25 shadow-[0_30px_80px_-20px_rgba(212,175,55,0.25)] ${showCam ? '' : 'hidden'}`}>
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover -scale-x-100"/>
        {/* Oval mask + progress ring */}
        <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full pointer-events-none">
          <defs><mask id="fk-oval"><rect width="300" height="400" fill="white"/><ellipse cx="150" cy="185" rx="104" ry="138" fill="black"/></mask></defs>
          <rect width="300" height="400" fill="rgba(6,6,8,0.72)" mask="url(#fk-oval)"/>
          <ellipse cx="150" cy="185" rx="104" ry="138" fill="none" stroke="rgba(212,175,55,0.25)" strokeWidth="3"/>
          {state === 'running' && (
            <ellipse cx="150" cy="185" rx="104" ry="138" fill="none" stroke="url(#fk-gold)" strokeWidth="5" strokeLinecap="round" pathLength="100"
              strokeDasharray={`${((stepIdx + (phase === 'hold' || phase === 'done' ? holdPct / 100 : 0)) / Math.max(1, steps.length)) * 100} 100`} transform="rotate(-90 150 185)" style={{ transition: 'stroke-dasharray 80ms linear' }}/>
          )}
          <defs><linearGradient id="fk-gold" x1="0" x2="1"><stop offset="0" stopColor="#f6e27a"/><stop offset="1" stopColor="#b8860b"/></linearGradient></defs>
        </svg>
        {state === 'starting' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold"/></div>}
        {state === 'ready' && (
          <div className="absolute bottom-4 inset-x-4 flex justify-center">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs backdrop-blur-md ${lightOk === false ? 'bg-amber-500/20 text-amber-200' : 'bg-black/50 text-white/90'}`}>
              <Sun className="h-3.5 w-3.5"/>{lightOk == null ? 'Checking light…' : lightOk ? 'Lighting looks good' : light <= 70 ? 'Too dark — face a light source' : 'Too bright — avoid direct light'}
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {state === 'running' && cur && (
            <motion.div key={cur + stepIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="absolute bottom-4 inset-x-3">
              <div className="rounded-2xl bg-black/65 backdrop-blur-md border border-gold-500/25 px-4 py-3 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${phase === 'done' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold-500/15 text-gold'}`}>
                  {phase === 'done' ? <Check className="h-5 w-5"/> : <CurIcon className={`h-5 w-5 ${cur === 'left' ? 'animate-[pulse_1s_ease-in-out_infinite]' : ''}`}/>}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gold/80">Step {stepIdx + 1} of {steps.length}</div>
                  <div className="text-sm font-medium text-white">{curText}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {state === 'processing' && <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 text-sm text-white"><Loader2 className="h-7 w-7 animate-spin text-gold"/>Securing your capture…</div>}
      </div>

      {state === 'idle' && (
        <div className="rounded-3xl border border-gold-500/20 bg-gradient-to-b from-gold-500/[0.07] to-transparent p-6 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold-500/10 ring-1 ring-gold-500/30 flex items-center justify-center"><ScanFace className="h-8 w-8 text-gold"/></div>
          <div>
            <div className="font-display text-xl">Liveness check</div>
            <div className="text-sm text-muted-foreground mt-1">We'll ask you to make a few quick head movements. It takes about 20 seconds and confirms that it's really you.</div>
          </div>
          <ul className="text-left text-xs text-muted-foreground space-y-2 max-w-sm mx-auto">
            {['Find good, even lighting — face a window or lamp', 'Remove sunglasses, hats and face coverings', 'Keep only your face in the frame', 'Hold your phone at eye level'].map(t => <li key={t} className="flex gap-2"><Check className="h-4 w-4 text-gold shrink-0"/>{t}</li>)}
          </ul>
          <div className="flex gap-2 justify-center">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Back</Button>}
            <Button onClick={startCamera} className="gold-btn rounded-full px-6 h-11" data-testid="liveness-open-camera"><Camera className="h-4 w-4 mr-2"/>Open camera</Button>
          </div>
        </div>
      )}
      {state === 'ready' && (
        <div className="text-center space-y-3">
          <div className="text-sm text-muted-foreground">Position your face inside the oval, then start.</div>
          <Button onClick={run} className="gold-btn rounded-full px-8 h-12" data-testid="liveness-start"><ShieldCheck className="h-4 w-4 mr-2"/>Start liveness check</Button>
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-center space-y-3">
          <AlertTriangle className="h-7 w-7 text-red-400 mx-auto"/>
          <div className="text-sm">{err}</div>
          <Button onClick={startCamera} variant="outline" className="border-gold-500/40"><RotateCcw className="h-4 w-4 mr-2"/>Try again</Button>
        </div>
      )}
      {state === 'review' && result && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-medium"><Check className="h-5 w-5"/>Liveness capture complete</div>
          {previews.video && <video src={previews.video} controls playsInline className="mx-auto w-full max-w-[300px] rounded-2xl ring-1 ring-gold-500/20 -scale-x-100"/>}
          <div className="grid grid-cols-5 gap-2">
            {previews.frames.map((u, i) => (
              <div key={i} className="space-y-1">
                <img src={u} alt="" className="aspect-[3/4] w-full object-cover rounded-lg ring-1 ring-gold-500/20 -scale-x-100"/>
                <div className="text-[9px] text-center text-muted-foreground truncate">{challengeLabel(result.frames[i]?.challenge)}</div>
              </div>
            ))}
          </div>
          {result.frames.length < 4 && <div className="text-xs text-amber-400 text-center">Some captures failed — please retake.</div>}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={retake} className="border-gold-500/40 rounded-full" data-testid="liveness-retake"><RotateCcw className="h-4 w-4 mr-2"/>Retake</Button>
            <Button onClick={() => onComplete(result)} disabled={result.frames.length < 4} className="gold-btn rounded-full px-6" data-testid="liveness-use"><Check className="h-4 w-4 mr-2"/>Use this capture</Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default LivenessCheck
