'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Mail, MessageSquare, Phone, MapPin } from 'lucide-react'

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    // For MVP: store nothing server-side, just acknowledge
    setTimeout(() => {
      setLoading(false)
      toast.success('Message received. An Aurela specialist will reach out shortly.')
      setForm({ name: '', email: '', subject: '', message: '' })
    }, 700)
  }

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-gold">Contact</div>
          <h1 className="font-display text-5xl md:text-6xl mt-3">We are listening.</h1>
          <p className="text-muted-foreground mt-5 text-lg">For onboarding, partnerships, compliance inquiries or high-touch support, write to us. Our team responds personally.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-14">
          <div className="lg:col-span-2 card-luxury rounded-3xl p-8">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full name</Label>
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Subject</Label>
                <Input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="mt-2 bg-secondary border-gold-500/20 h-11"/>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Message</Label>
                <textarea required rows={6} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="mt-2 w-full bg-secondary border border-gold-500/20 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"/>
              </div>
              <Button disabled={loading} type="submit" className="gold-btn h-12 rounded-xl px-8">{loading ? 'Sending…' : 'Send message'}</Button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="card-luxury rounded-2xl p-6">
              <Mail className="h-5 w-5 text-gold-bright"/>
              <div className="font-display text-lg mt-3">Email</div>
              <a href="mailto:hello@aurelawallet.com" className="text-sm text-gold">hello@aurelawallet.com</a>
              <div className="text-xs text-muted-foreground mt-1">General & onboarding</div>
            </div>
            <div className="card-luxury rounded-2xl p-6">
              <MessageSquare className="h-5 w-5 text-gold-bright"/>
              <div className="font-display text-lg mt-3">Support</div>
              <a href="mailto:support@aurelawallet.com" className="text-sm text-gold">support@aurelawallet.com</a>
              <div className="text-xs text-muted-foreground mt-1">Account & transactions</div>
            </div>
            <div className="card-luxury rounded-2xl p-6">
              <ShieldContactIcon/>
              <div className="font-display text-lg mt-3">Compliance</div>
              <a href="mailto:compliance@aurelawallet.com" className="text-sm text-gold">compliance@aurelawallet.com</a>
              <div className="text-xs text-muted-foreground mt-1">KYC, AML and regulatory</div>
            </div>
            <div className="card-luxury rounded-2xl p-6">
              <MapPin className="h-5 w-5 text-gold-bright"/>
              <div className="font-display text-lg mt-3">Domain</div>
              <div className="text-sm text-gold">www.aurelawallet.com</div>
              <div className="text-xs text-muted-foreground mt-1">Global service platform</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ShieldContactIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f5e29d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.5 9.4 8 11 4.5-1.6 8-6 8-11V5l-8-3Z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}
