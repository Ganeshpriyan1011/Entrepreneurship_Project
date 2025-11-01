import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { OtpService } from '../otp'
import { sendMail, otpEmailHtml, welcomeEmailHtml, isSmtpConfigured } from '../mailer'

const router = Router()

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email required' })

    const existing = await User.findByEmail(email)
    if (existing) return res.status(400).json({ error: 'email already in use' })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await OtpService.create(email, code, 600)

    const mailRes = await sendMail({ to: email, subject: 'Verify your email', html: otpEmailHtml(code) })
    const devMode = process.env.NODE_ENV !== 'production'
    const previewUrl = (mailRes as any)?.previewUrl

    const body: any = { ok: true }
    // Expose devCode and previewUrl when SMTP isn't configured OR when we had to fallback in dev
    if (!isSmtpConfigured() || (devMode && previewUrl)) {
      body.devCode = code
      if (previewUrl) body.previewUrl = previewUrl
    }
    return res.json(body)
  } catch (error: any) {
    console.error('Send OTP error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

router.post('/signup', async (req, res) => {
  try {
    const { email, password, otp } = req.body || {}
    if (!email || !password || !otp) return res.status(400).json({ error: 'email, password and otp required' })

    const existing = await User.findByEmail(email)
    if (existing) return res.status(400).json({ error: 'email already in use' })

    const ok = await OtpService.verify(email, otp)
    if (!ok) return res.status(400).json({ error: 'invalid or expired otp' })

    const passwordHash = await bcrypt.hash(password, 12)
    await User.create(email, passwordHash)

    const mailRes = await sendMail({ to: email, subject: 'Welcome to Secure Azure Storage', html: welcomeEmailHtml(email) })
    const devMode = process.env.NODE_ENV !== 'production'
    const previewUrl = (mailRes as any)?.previewUrl
    const body: any = { ok: true }
    // Expose previewUrl when SMTP isn't configured OR when we had to fallback in dev
    if (!isSmtpConfigured() || (devMode && previewUrl)) {
      if (previewUrl) body.previewUrl = previewUrl
    }
    return res.json(body)
  } catch (error: any) {
    console.error('Signup error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    
    const user = await User.findByEmail(email)
    if (!user) return res.status(401).json({ error: 'invalid credentials' })
    
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid credentials' })

    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' })
    const token = jwt.sign({}, secret, { subject: user.email, expiresIn: '7d' })

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    })
    return res.json({ ok: true, token })
  } catch (error: any) {
    console.error('Login error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

export default router
