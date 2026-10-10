'use client'

// Last-resort error UI: catches errors thrown in the root layout itself.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, width: '100%', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 16, padding: 32, textAlign: 'center', background: '#0a0a0a' }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#d4af37', letterSpacing: 1 }}>Aurela</div>
            <div style={{ marginTop: 16, fontSize: 18 }}>Something went wrong</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999', wordBreak: 'break-all' }}>{error?.message || 'An unexpected error occurred.'}</div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => reset()} style={{ padding: '8px 20px', borderRadius: 999, border: 'none', background: '#d4af37', color: '#000', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
              <button onClick={() => { window.location.href = '/' }} style={{ padding: '8px 20px', borderRadius: 999, border: '1px solid rgba(212,175,55,0.5)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Go home</button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
