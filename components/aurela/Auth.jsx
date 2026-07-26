'use client'

import { useState } from 'react'
import { useApp } from './store'
import { AurelaLogo } from './Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Eye, EyeOff, ShieldCheck, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useGoogleLogin } from '@react-oauth/google'

export function Auth() {
  const { setRoute, authMode, setAuthMode, login, api, refreshUser } = useApp()
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('form') // form | otp | totp
  const [otp, setOtp] = useState('')
  const [totp, setTotp] = useState('')
  const [signupId, setSignupId] = useState(null)
  const [devOtp, setDevOtp] = useState(null)
  const [form, setForm] = useState({ identifier: '', email: '', username: '', full_name: '', phone: '', password: '' })

  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      if (authMode === 'login') {
        try {
          await login(form.identifier || form.email, form.password)
          toast.success('Welcome back to Aurela')
        } catch(err) {
          if (String(err.message).includes('2FA')) { setStep('totp'); toast.info('Enter your 2FA code'); return }
          throw err
        }
      } else {
        // Two-step signup: init -> verify OTP
        const res = await api.post('/auth/register/init', {
          email: form.email, username: form.username, full_name: form.full_name, phone: form.phone, password: form.password
        })
        setSignupId(res.signup_id)
        setDevOtp(res.dev_otp || null)
        setStep('otp')
        toast.success('Verification code sent to your email')
      }
    } catch(err) {
      toast.error(err.message || 'Something went wrong')
    } finally { setLoading(false) }
  }

  const verifyOTP = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await api.post('/auth/register/verify', { signup_id: signupId, email: form.email, code: otp })
      // Persist token + user in store
      api.setToken(res.token)
      await refreshUser()
      toast.success('Welcome to Aurela')
      setRoute('dashboard')
    } catch(err) {
      toast.error(err.message || 'Invalid or expired code')
    } finally { setLoading(false) }
  }

  const resendOTP = async () => {
    try {
      const res = await api.post('/auth/register/resend', { email: form.email })
      setDevOtp(res.dev_otp || null)
      toast.success('New code sent to your email')
    } catch(e) { toast.error(e.message) }
  }

  const googleSignin = async (data) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/google', data)
      api.setToken(res.token)
      await refreshUser()
      toast.success('Welcome to Aurela')
      setRoute(res.user.role === 'admin' || res.user.role === 'super_admin' ? 'admin' : 'dashboard')
    } catch(e) {
      toast.error(e.message || 'Google sign-in failed')
    } finally { setLoading(false) }
  }

  const doGoogle = useGoogleLogin({
    onSuccess: (tokenResponse) => googleSignin({ access_token: tokenResponse.access_token }),
    onError: () => toast.error('Google sign-in failed'),
    flow: 'implicit',
  })

  const switchMode = (mode) => { setAuthMode(mode); setStep('form'); setOtp(''); setSignupId(null); setDevOtp(null) }

  return (
    <div className="min-h-screen bg-onyx-radial relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 grid-lines opacity-30"/>
      <button onClick={() => setRoute('landing')} className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-4 w-4"/> Back to Aurela
      </button>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md relative z-10">
        <div className="card-luxury rounded-3xl p-8">
          <div className="flex items-center gap-3 justify-center mb-6">
            <AurelaLogo size={42}/>
            <div>
              <div className="font-display text-2xl tracking-widest gold-text">AURELA</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Private banking · Digital assets</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div key="form" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="flex bg-secondary rounded-xl p-1 mb-6">
                  <button onClick={() => switchMode('login')} className={`flex-1 py-2 rounded-lg text-sm transition ${authMode === 'login' ? 'gold-btn' : 'text-muted-foreground'}`}>Sign in</button>
                  <button onClick={() => switchMode('register')} className={`flex-1 py-2 rounded-lg text-sm transition ${authMode === 'register' ? 'gold-btn' : 'text-muted-foreground'}`}>Create account</button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {authMode === 'login' ? (
                    <div>
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email or Username</Label>
                      <Input required value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} placeholder="you@aurelawallet.com" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full name</Label>
                          <Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                        </div>
                        <div>
                          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Username</Label>
                          <Input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
                        <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@domain.com" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
                        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 0000" className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                      </div>
                    </>
                  )}

                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
                    <div className="relative mt-2">
                      <Input required type={showPwd ? 'text' : 'password'} minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-secondary border-gold-500/20 h-11 pr-10"/>
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPwd ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                      </button>
                    </div>
                    {authMode === 'register' && <div className="text-[10px] text-muted-foreground mt-1">Minimum 8 characters.</div>}
                  </div>

                  <Button disabled={loading} type="submit" className="gold-btn w-full h-12 rounded-xl">
                    {loading ? 'Please wait…' : (authMode === 'login' ? 'Sign in to Aurela' : 'Send verification code')}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-gold-500/15"/>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">or continue with</div>
                  <div className="flex-1 h-px bg-gold-500/15"/>
                </div>

                <button type="button" onClick={() => doGoogle()} disabled={loading}
                  className="w-full h-12 rounded-xl flex items-center justify-center gap-3 bg-gradient-to-br from-onyx-800 to-onyx-900 border border-gold-500/30 hover:border-gold-500/60 hover:bg-onyx-800 transition group">
                  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span className="font-medium text-foreground group-hover:text-gold">
                    {authMode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
                  </span>
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="flex items-center justify-center gap-2 text-gold mb-3">
                  <MailCheck className="h-5 w-5"/>
                  <div className="font-display text-lg">Verify your email</div>
                </div>
                <div className="text-sm text-muted-foreground text-center mb-6">
                  We sent a 6-digit code to<br/><span className="text-gold-bright">{form.email}</span>
                </div>

                <form onSubmit={verifyOTP} className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Verification code</Label>
                    <Input required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" className="mt-2 bg-secondary border-gold-500/20 h-14 text-center text-2xl font-mono tracking-[0.6em] text-gold-bright"/>
                  </div>
                  <Button disabled={loading || otp.length !== 6} type="submit" className="gold-btn w-full h-12 rounded-xl">
                    {loading ? 'Verifying…' : 'Verify & Create account'}
                  </Button>
                </form>

                <div className="mt-4 text-center text-xs">
                  <button onClick={resendOTP} className="text-gold hover:underline">Resend code</button>
                  <span className="text-muted-foreground mx-2">·</span>
                  <button onClick={() => setStep('form')} className="text-muted-foreground hover:text-gold">Change email</button>
                </div>

                {devOtp && (
                  <div className="mt-4 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-yellow-400">Dev-only preview</div>
                    <div className="font-mono text-sm text-yellow-300">{devOtp}</div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'totp' && (
              <motion.div key="totp" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="flex items-center justify-center gap-2 text-gold mb-3">
                  <ShieldCheck className="h-5 w-5"/>
                  <div className="font-display text-lg">Two-factor authentication</div>
                </div>
                <div className="text-sm text-muted-foreground text-center mb-6">
                  Enter the 6-digit code from your authenticator app.
                </div>
                <form onSubmit={verifyTOTP} className="space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Authenticator code</Label>
                    <Input required value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="••••••" className="mt-2 bg-secondary border-gold-500/20 h-14 text-center text-2xl font-mono tracking-[0.6em] text-gold-bright"/>
                  </div>
                  <Button disabled={loading || totp.length !== 6} type="submit" className="gold-btn w-full h-12 rounded-xl">{loading?'Verifying…':'Sign in'}</Button>
                </form>
                <div className="mt-4 text-center text-xs">
                  <button onClick={() => { setStep('form'); setTotp('') }} className="text-muted-foreground hover:text-gold">Back to password</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-gold"/> Bank-grade encryption · Email OTP · 2FA ready
          </div>

          {step === 'form' && authMode === 'login' && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Trouble signing in? <a href="mailto:support@aurelawallet.com" className="text-gold">support@aurelawallet.com</a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
