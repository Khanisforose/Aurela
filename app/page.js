'use client'

import { useApp } from '@/components/aurela/store'
import { Landing } from '@/components/aurela/Landing'
import { Auth } from '@/components/aurela/Auth'
import { Dashboard } from '@/components/aurela/Dashboard'
import { AdminPanel } from '@/components/aurela/AdminPanel'
import { AurelaLogo } from '@/components/aurela/Logo'

function App() {
  const { loading, route, user } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-onyx-radial flex items-center justify-center">
        <div className="animate-float"><AurelaLogo size={80}/></div>
      </div>
    )
  }

  if (route === 'auth') return <Auth />
  if (route === 'dashboard' && user) return <Dashboard />
  if (route === 'admin' && user && (user.role === 'admin' || user.role === 'super_admin')) return <AdminPanel />
  return <Landing />
}

export default App
