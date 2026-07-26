'use client'

export function PrivacyPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-4xl">
        <div className="text-xs uppercase tracking-widest text-gold">Legal</div>
        <h1 className="font-display text-5xl md:text-6xl mt-3">Privacy Policy</h1>
        <p className="text-muted-foreground mt-4">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="mt-10 space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
          <Block title="1. Who we are">
            <p>Aurela (“Aurela”, “we”, “us”) is the operator of www.aurelawallet.com and the Aurela platform. This Privacy Policy explains how we collect, use, disclose and protect information about you.</p>
          </Block>
          <Block title="2. Information we collect">
            <p>We collect (a) information you provide when creating an account, such as your name, email, phone and password; (b) identity verification information required for KYC/AML including government-issued identifiers, dates of birth and addresses; (c) usage and device information such as IP address, device fingerprint, timestamps and endpoint access; (d) transaction records including counterparties, amounts, currencies and network metadata; (e) communications and support interactions.</p>
          </Block>
          <Block title="3. How we use information">
            <p>We use information to (i) provide, maintain and improve the Services; (ii) authenticate users and secure accounts; (iii) comply with legal, regulatory and law-enforcement obligations, including KYC and AML; (iv) prevent fraud, abuse and financial crime; (v) communicate with you about product updates, security notices and support; (vi) generate anonymized analytics that inform product decisions.</p>
          </Block>
          <Block title="4. Legal bases">
            <p>Where applicable data protection law requires it, we rely on the following legal bases: performance of a contract with you, compliance with legal obligations, our legitimate interests in operating and securing the Services, and your consent where required.</p>
          </Block>
          <Block title="5. Sharing information">
            <p>We share information only with (a) service providers acting on our behalf under contractual confidentiality (for example identity verification, hosting and analytics); (b) regulatory, tax and law-enforcement authorities where legally required; (c) counterparties to a transaction, limited to what is strictly required to settle the transaction; (d) prospective acquirers in the context of a merger or acquisition. We do not sell your personal information.</p>
          </Block>
          <Block title="6. Security">
            <p>We implement industry-standard technical and organizational measures to protect information, including AES-256 encryption at rest, transport encryption, hardened session management, rate limiting and continuous audit logging of privileged actions. No system is perfectly secure; we continuously invest in improving our defensive posture.</p>
          </Block>
          <Block title="7. Data retention">
            <p>We retain personal information for as long as necessary to provide the Services and to comply with applicable legal obligations, including anti-money-laundering record-keeping. Retention periods may vary by data category and jurisdiction.</p>
          </Block>
          <Block title="8. Your rights">
            <p>Depending on your jurisdiction you may have rights to access, correct, delete, restrict or object to processing of your personal information, and to portability. To exercise these rights please contact <a className="text-gold" href="mailto:privacy@aurelawallet.com">privacy@aurelawallet.com</a>. Some rights may be limited where retention is required by law.</p>
          </Block>
          <Block title="9. International transfers">
            <p>Aurela is a global platform. Information may be processed in jurisdictions other than your own. We use appropriate safeguards (for example standard contractual clauses) when required by applicable law.</p>
          </Block>
          <Block title="10. Cookies">
            <p>We use strictly necessary cookies to authenticate users and maintain sessions. We may use additional cookies for analytics or preferences where allowed. You can manage cookies via your browser settings.</p>
          </Block>
          <Block title="11. Changes">
            <p>We may update this Privacy Policy from time to time. Material changes will be communicated in-product or by email. Continued use of the Services after an update constitutes acceptance of the revised Policy.</p>
          </Block>
          <Block title="12. Contact">
            <p>Privacy questions may be sent to <a className="text-gold" href="mailto:privacy@aurelawallet.com">privacy@aurelawallet.com</a>.</p>
          </Block>
        </div>
      </div>
    </section>
  )
}

function Block({ title, children }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-gold-bright">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}
