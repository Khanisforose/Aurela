'use client'

export function TermsPage() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-4xl">
        <div className="text-xs uppercase tracking-widest text-gold">Legal</div>
        <h1 className="font-display text-5xl md:text-6xl mt-3">Terms of Service</h1>
        <p className="text-muted-foreground mt-4">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="mt-10 space-y-8 text-sm md:text-base leading-relaxed text-muted-foreground">
          <Block title="1. Introduction">
            <p>These Terms of Service (“Terms”) govern your access to and use of the Aurela platform, including www.aurelawallet.com, the Aurela web application, associated APIs, wallets and virtual card services (collectively, the “Services”) provided by Aurela (“Aurela”, “we”, “us”). By creating an account or using the Services you agree to be bound by these Terms.</p>
          </Block>
          <Block title="2. Eligibility">
            <p>You must be at least 18 years of age and legally capable of entering into a binding contract in your jurisdiction. You must not be located in, or a resident of, a sanctioned or prohibited jurisdiction. You are responsible for ensuring your use of the Services complies with all laws applicable to you.</p>
          </Block>
          <Block title="3. Account Registration and KYC">
            <p>To access certain features (including withdrawals, virtual card issuance and elevated tier services) you must complete our Know Your Customer (KYC) process. You agree to provide accurate, current and complete information and to keep it up to date. Aurela may suspend, restrict or terminate any account that fails to satisfy verification or that we reasonably believe presents legal, regulatory or fraud risk.</p>
          </Block>
          <Block title="4. The Services">
            <p>Aurela provides (a) multi-currency ledger accounts, (b) digital asset wallets across supported networks, (c) instant internal transfers on the Aurela network, (d) deposit and withdrawal rails via supported partners, and (e) virtual card issuance across our Basic, Premium and Elite tiers. Availability of specific features may vary by jurisdiction and account status.</p>
          </Block>
          <Block title="5. Fees and Card Activation">
            <p>Aurela may charge fees for certain features, including virtual card activation. Card activation fees are payable in USDT on the network configured by Aurela administration and may be revised from time to time at Aurela’s sole discretion. Current fees are always displayed inside the product prior to confirmation.</p>
          </Block>
          <Block title="6. Digital Assets">
            <p>You understand that digital assets are inherently volatile and that transactions on blockchain networks are irreversible. You are responsible for verifying wallet addresses, networks and amounts. Aurela is not liable for losses arising from user error, network congestion, or forks and reorganizations of underlying blockchains.</p>
          </Block>
          <Block title="7. Prohibited Activities">
            <p>You must not use the Services for any unlawful, deceptive or abusive purpose. This includes money laundering, terrorist financing, sanctions evasion, unauthorized gambling, fraud, or any activity that violates applicable law. Aurela reserves the right to freeze balances, block accounts and cooperate with authorities.</p>
          </Block>
          <Block title="8. Suspension and Termination">
            <p>Aurela may suspend, restrict or terminate your account or any Service at any time, with or without notice, where required by law, in cases of suspected fraud or breach of these Terms, or where the operational integrity of the platform is at risk.</p>
          </Block>
          <Block title="9. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, Aurela’s aggregate liability for any claim arising out of or relating to the Services is limited to the fees you paid to Aurela in the twelve (12) months preceding the event giving rise to the claim. Aurela is not liable for indirect, incidental, consequential or exemplary damages.</p>
          </Block>
          <Block title="10. Governing Law">
            <p>These Terms are governed by the laws of the jurisdiction in which the applicable Aurela entity is incorporated. Any dispute will be resolved by the competent courts of that jurisdiction, unless otherwise required by local mandatory law.</p>
          </Block>
          <Block title="11. Changes">
            <p>Aurela may update these Terms from time to time. Material changes will be communicated in-product or by email. Continued use of the Services after an update constitutes acceptance of the revised Terms.</p>
          </Block>
          <Block title="12. Contact">
            <p>Questions about these Terms may be sent to <a className="text-gold" href="mailto:legal@aurelawallet.com">legal@aurelawallet.com</a>.</p>
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
