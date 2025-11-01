// Using local typing to avoid deep import type issues in some setups

export interface MailOptions {
  to: string
  subject: string
  html: string
}

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  return !!(host && port && user && pass)
}

export async function sendMail(opts: MailOptions): Promise<{ previewUrl?: string } | void> {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.MAIL_FROM || 'no-reply@secure-storage.local'
  const secure = process.env.SMTP_SECURE === 'true'

  // Fallback: if SMTP not configured, log the email
  if (!host || !port || !user || !pass) {
    try {
      const mod = await import('nodemailer')
      const createTransport = (mod as any).default?.createTransport || (mod as any).createTransport
      const createTestAccount = (mod as any).default?.createTestAccount || (mod as any).createTestAccount
      const getTestMessageUrl = (mod as any).default?.getTestMessageUrl || (mod as any).getTestMessageUrl

      const testAccount = await createTestAccount()
      const transporter = createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      } as any)

      const info = await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html })
      const previewUrl: string | false = getTestMessageUrl(info)
      console.log('[MAIL:ETHEREAL]', { to: opts.to, subject: opts.subject, previewUrl })
      return previewUrl ? { previewUrl } : undefined
    } catch (err) {
      console.log('[MAIL:FALLBACK]', {
        from,
        to: opts.to,
        subject: opts.subject,
        htmlPreview: opts.html.substring(0, 200) + (opts.html.length > 200 ? '...' : '')
      })
      return
    }
  }

  let transporter: any
  try {
    const mod = await import('nodemailer')
    const createTransport = (mod as any).default?.createTransport || (mod as any).createTransport
    transporter = createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    } as any)
  } catch (err) {
    console.warn('Nodemailer not available; logging email instead', err)
    console.log('[MAIL:FALLBACK]', { to: opts.to, subject: opts.subject })
    return
  }

  try {
    await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html })
  } catch (err) {
    // If SMTP is configured but sending fails (e.g., BadCredentials), fallback to Ethereal for preview
    try {
      const mod = await import('nodemailer')
      const createTransport = (mod as any).default?.createTransport || (mod as any).createTransport
      const createTestAccount = (mod as any).default?.createTestAccount || (mod as any).createTestAccount
      const getTestMessageUrl = (mod as any).default?.getTestMessageUrl || (mod as any).getTestMessageUrl

      const testAccount = await createTestAccount()
      const fallbackTransporter = createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      } as any)

      const info = await fallbackTransporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html })
      const previewUrl: string | false = getTestMessageUrl(info)
      console.warn('SMTP send failed, using Ethereal fallback. Error:', (err as any)?.message || err)
      console.log('[MAIL:ETHEREAL:FALLBACK]', { to: opts.to, subject: opts.subject, previewUrl })
      return previewUrl ? { previewUrl } : undefined
    } catch (fallbackErr) {
      console.error('SMTP send failed and Ethereal fallback failed; logging email.', fallbackErr)
      console.log('[MAIL:FALLBACK]', {
        from,
        to: opts.to,
        subject: opts.subject,
        htmlPreview: opts.html.substring(0, 200) + (opts.html.length > 200 ? '...' : '')
      })
      return
    }
  }
}

export function welcomeEmailHtml(email: string): string {
  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="color:#333">Welcome to Secure Azure Storage</h2>
    <p>Hi ${email},</p>
    <p>Thanks for creating your account. Here’s what you get:</p>
    <ul>
      <li><strong>Client-side encryption</strong> — your files are encrypted in your browser using AES-GCM.</li>
      <li><strong>Key-verified deletion</strong> — delete requires your key hash for extra safety.</li>
      <li><strong>Azure-backed storage</strong> — durable and scalable.</li>
      <li><strong>Zero-knowledge</strong> — we never see your key or unencrypted files.</li>
    </ul>
    <p style="margin:16px 0 0">We’re glad you’re here — thank you!</p>
    <p style="color:#666">— Secure Azure Storage Team</p>
  </div>`
}

export function otpEmailHtml(code: string): string {
  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="color:#333">Your verification code</h2>
    <p>Use the code below to verify your email and complete signup:</p>
    <div style="font-size:24px;font-weight:700;letter-spacing:2px;background:#f7fbff;border:1px solid #e3f0ff;border-radius:8px;display:inline-block;padding:12px 16px;margin:10px 0">${code}</div>
    <p style="color:#666">This code expires in 10 minutes.</p>
  </div>`
}