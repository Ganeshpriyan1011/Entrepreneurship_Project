import React, { useState } from 'react'
import { Auth } from '../api/client'
import { AuthInfo } from './AuthInfo'

export function Login({ api }: { api: { setAuthed: (t: string) => void; goSignup: () => void } }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      const res = await Auth.login(email, password)
      api.setAuthed(res?.token || 'ok')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-2">
      <div style={{ minWidth: 0 }}>
        <AuthInfo />
      </div>
      <div className="card" style={{ maxWidth: '520px' }}>
      <h2 className="card-title center" style={{ marginBottom: '24px' }}>
        Log in to your account
      </h2>
      
      {msg && (
        <div className="message error" style={{ marginBottom: '20px' }}>
          {msg}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input 
            id="email"
            type="email" 
            placeholder="Enter your email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </div>
        
        <div className="field">
          <label htmlFor="password" className="label">Password</label>
          <input 
            id="password"
            type="password" 
            placeholder="Enter your password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', marginBottom: '16px', opacity: loading ? 0.8 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
        
        <div style={{ textAlign: 'center' }}>
          <p style={{ 
            margin: '0',
            color: '#666',
            fontSize: '14px'
          }}>
            Don't have an account?{' '}
            <button type="button" onClick={api.goSignup} className="link">
              Sign up
            </button>
          </p>
        </div>
      </form>
    </div>
    </div>
  )
}
