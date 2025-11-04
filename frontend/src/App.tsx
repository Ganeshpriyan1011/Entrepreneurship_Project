import React, { useMemo, useState } from 'react'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Dashboard } from './pages/Dashboard'
import AzureIcon from './components/AzureIcon'

export default function App() {
  // ✅ Default view = login page
  const [view, setView] = useState<'login' | 'signup' | 'dashboard'>('login')

  // ✅ API methods shared between components
  const api = useMemo(() => ({
    // Called after successful login/signup
    setAuthed() {
      setView('dashboard')
    },

    // Logout resets state and clears cookies on backend
    async logout() {
      try {
        // Optional: Call backend logout endpoint if implemented
        await fetch('https://backendeedlinux.azurewebsites.net/api/auth/logout', {
          method: 'POST',
          credentials: 'include', // 🔑 Ensures cookies are sent
        })
      } catch (err) {
        console.warn('Logout API not available, using client-side fallback')
      }

      setView('login')
    },

    // Navigation helpers
    goSignup() { setView('signup') },
    goLogin() { setView('login') },
  }), [])

  return (
    <div className="app-container">
      <header
        className="app-header"
        style={{ borderBottom: view === 'dashboard' ? 'none' : '1px solid var(--border)' }}
      >
        <div className="brand">
          <div className="logo">
            <AzureIcon size={32} />
          </div>
          <h1 className="brand-title">Secure Azure Storage</h1>
        </div>

        {view === 'dashboard' && (
          <div className="nav-actions">
            <button className="btn btn-outline" onClick={api.logout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main>
        {view === 'login' && <Login api={api} />}
        {view === 'signup' && <Signup api={api} />}
        {view === 'dashboard' && <Dashboard api={api} />}
      </main>

      {(view === 'login' || view === 'signup') && (
        <footer className="footer">
          <p>Secure file storage with client-side encryption</p>
          <p style={{ margin: '5px 0' }}>
            Your files are encrypted before upload using AES-GCM encryption
          </p>
        </footer>
      )}
    </div>
  )
}
