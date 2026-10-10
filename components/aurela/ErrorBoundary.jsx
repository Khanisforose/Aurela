'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Catches render-time exceptions in a subtree so one broken tab/section never
// takes down the whole app with Next.js' generic "Application error" page.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    try { console.error('[Aurela] UI section crashed:', error, info?.componentStack) } catch (e) {}
  }

  componentDidUpdate(prevProps) {
    // Auto-reset when the user navigates to a different section (resetKey changes)
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    const msg = this.state.error?.message || 'Unexpected error'
    return (
      <div className="card-luxury rounded-2xl p-8 text-center border border-red-500/20">
        <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-red-400"/>
        </div>
        <div className="font-display text-lg mt-4">{this.props.title || 'This section ran into a problem'}</div>
        <div className="text-xs text-muted-foreground mt-2 break-all max-w-md mx-auto">{msg}</div>
        <div className="flex justify-center gap-2 mt-5">
          <Button onClick={this.reset} className="gold-btn rounded-full"><RefreshCw className="h-4 w-4 mr-2"/>Try again</Button>
          <Button variant="outline" onClick={() => { if (typeof window !== 'undefined') window.location.reload() }} className="rounded-full border-gold-500/40">Reload app</Button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
