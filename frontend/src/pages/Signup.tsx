import React, { useState } from 'react'
import { Auth } from '../api/client'
import { AuthInfo } from './AuthInfo'

export function Signup({ api }: { api: { goLogin: () => void } }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [msg, setMsg] = useState<string | null>(null)
  const [msgType, setMsgType] = useState<'success' | 'error'>('error')
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      const res = await Auth.sendOtp(email)
      if (res?.devCode) {
        setMsg(`Verification code (dev): ${res.devCode}. Use it to verify your email.`)
      } else {
        setMsg('Verification code sent to your email. Please check your inbox.')
      }
      setPreviewUrl(res?.previewUrl || null)
      setMsgType('success')
      setStep('verify')
    } catch (e: any) {
      setMsg(e.message)
      setMsgType('error')
    } finally {
      setLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    try {
      const res = await Auth.signup(email, password, otp)
      setMsg('Account created successfully! Check your inbox for a welcome email.')
      setMsgType('success')
      setEmail('')
      setPassword('')
      setOtp('')
      setPreviewUrl(res?.previewUrl || null)
      setStep('request')
    } catch (e: any) {
      setMsg(e.message)
      setMsgType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-2">
      <div style={{ flex: 1, minWidth: 0 }}>
        <AuthInfo />
      </div>
      <div className="card" style={{ maxWidth: '520px' }}>
      <h2 className="card-title center" style={{ margin: '0 0 24px 0' }}>
        Create your account
      </h2>
      {/* OTP details moved to AuthInfo feature card */}
      
      {msg && (
        <div className={`message ${msgType === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '20px' }}>
          <div>{msg}</div>
          {previewUrl && (
            <div style={{ marginTop: '8px' }}>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="link">
                Open email preview
              </a>
            </div>
          )}
        </div>
      )}
      
      {step === 'request' ? (
        <form onSubmit={sendCode}>
          <div style={{ marginBottom: '16px' }}>
            <label 
              htmlFor="email" 
              style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontSize: '14px',
                color: '#555'
              }}
            >
              Email address
            </label>
            <input 
              id="email"
              type="email" 
              placeholder="Enter your email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: '16px', opacity: loading ? 0.8 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending code...' : 'Send verification code'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ 
              margin: '0',
              color: '#666',
              fontSize: '14px'
            }}>
              Already have an account?{' '}
              <button type="button" onClick={api.goLogin} className="link">
                Log in
              </button>
            </p>
          </div>
        </form>
      ) : (
        <form onSubmit={submit}>
          <div style={{ marginBottom: '16px' }}>
            <label 
              htmlFor="email" 
              style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontSize: '14px',
                color: '#555'
              }}
            >
              Email address
            </label>
            <input 
              id="email"
              type="email" 
              value={email} 
              disabled
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: '#f7f7f7'
              }}
            />
          <div style={{ marginTop: '6px' }}>
            <button type="button" onClick={sendCode} style={{ background: 'none', border: 'none', color: '#4285F4', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
              Resend code
            </button>
          </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label 
              htmlFor="otp" 
              style={{ 
                display: 'block', 
                marginBottom: '6px', 
                fontSize: '14px',
                color: '#555'
              }}
            >
              Verification code
            </label>
            <input 
              id="otp"
              type="text" 
              placeholder="Enter the 6-digit code"
              value={otp} 
              onChange={(e) => setOtp(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label 
              htmlFor="password" 
              style={{ 
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#555'
              }}
            >
              Password
            </label>
            <input 
              id="password"
              type="password" 
              placeholder="Create a password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
              required
              minLength={6}
            />
            <p style={{ 
              margin: '6px 0 0 0',
              fontSize: '12px',
              color: '#666'
            }}>
              Password must be at least 6 characters
            </p>
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px', marginBottom: '16px', opacity: loading ? 0.8 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ 
              margin: '0',
              color: '#666',
              fontSize: '14px'
            }}>
              Already have an account?{' '}
              <button type="button" onClick={api.goLogin} className="link">
                Log in
              </button>
            </p>
          </div>
        </form>
      )}
    </div>
    </div>
  )
}
