'use client'

import { ShieldCheck, ScrollText, Users, LockKeyhole } from 'lucide-react'

const pillars = [
  { icon: ShieldCheck, title: 'KYC / Customer Due Diligence', desc: 'Every Aurela member completes structured identity verification prior to withdrawal or elevated card issuance, including government ID, address confirmation and screening.' },
  { icon: Users, title: 'Sanctions & PEP Screening', desc: 'Continuous screening against international sanctions lists and politically exposed persons registers, with escalation and case management workflows.' },
  { icon: LockKeyhole, title: 'Transaction Monitoring', desc: 'Automated rules and behavioural analytics on deposits, transfers, withdrawals and card activity, with human review for elevated risk signals.' },
  { icon: ScrollText, title: 'Immutable Audit Trail', desc: 'Every privileged and money-movement action is permanently logged and reviewable by administrators and regulators upon lawful request.' },
]

export function CompliancePage() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-5xl">
        <div className="text-xs uppercase tracking-widest text-gold">Compliance</div>
        <h1 className="font-display text-5xl md:text-6xl mt-3">Compliance is a design principle, not an afterthought.</h1>
        <p className="text-muted-foreground mt-5 text-lg">Aurela is engineered from the ground up to meet the expectations of regulated financial infrastructure. Our compliance stack combines rigorous customer due diligence, continuous monitoring and full auditability with a member experience that remains elegant and frictionless.</p>

        <div className="grid md:grid-cols-2 gap-6 mt-14">
          {pillars.map((p, i) => (
            <div key={i} className="card-luxury rounded-2xl p-6 flex gap-4">
              <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-gold-500/25 to-gold-800/10 border border-gold-500/25">
                <p.icon className="h-6 w-6 text-gold-bright"/>
              </div>
              <div>
                <div className="font-display text-xl">{p.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 card-luxury rounded-3xl p-10">
          <h2 className="font-display text-3xl text-gold-bright">Reporting suspicious activity</h2>
          <p className="text-muted-foreground mt-4">If you have information about fraud, money laundering, sanctions evasion or any other suspicious activity involving Aurela, please contact <a className="text-gold" href="mailto:compliance@aurelawallet.com">compliance@aurelawallet.com</a>. Aurela investigates every credible report and cooperates with competent authorities as required by law.</p>
        </div>

        <div className="mt-8 card-luxury rounded-3xl p-10">
          <h2 className="font-display text-3xl text-gold-bright">Regulatory engagement</h2>
          <p className="text-muted-foreground mt-4">Aurela actively engages with regulators, banking partners and industry bodies across the jurisdictions in which we operate. Where required, Aurela services are provided by, or in partnership with, appropriately licensed institutions. Availability of specific features may vary by jurisdiction and account status.</p>
        </div>
      </div>
    </section>
  )
}
