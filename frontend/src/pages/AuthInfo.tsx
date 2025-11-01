import React from 'react'
import AzureIcon from '../components/AzureIcon'

export function AuthInfo() {
  return (
    <div className="card">
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <AzureIcon size={28} />
          <h2 className="card-title" style={{ margin: 0, fontSize: '22px' }}>
            Why Secure Azure Storage?
          </h2>
        </div>
        <p className="muted" style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
          Fast, privacy-first file storage with client-side encryption and easy access.
        </p>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          {
            title: 'Client-side encryption',
            desc: 'Files are encrypted in your browser using AES-GCM before upload.'
          },
          {
            title: 'Key-verified deletion',
            desc: 'Delete requires the correct key hash to prevent accidental removal.'
          },
          {
            title: 'Email OTP verification',
            desc: 'Signup requires a 6-digit code sent to your email. Codes expire in 10 minutes; resend available. In development a preview link may be shown.'
          },
          {
            title: 'Azure-backed storage',
            desc: 'Durable, scalable storage powered by Azure Blob + Table Storage.'
          },
          {
            title: 'Zero-knowledge approach',
            desc: 'We never see your encryption key or unencrypted file data.'
          },
          {
            title: 'Simple uploads & downloads',
            desc: 'Clean interface for managing files securely and efficiently.'
          }
        ].map((item, i) => (
          <li key={i} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            padding: '10px 0',
            borderBottom: i === 4 ? 'none' : '1px solid #f1f1f1'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#eaf2ff',
              color: '#4285F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>✓</div>
            <div>
              <div style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>{item.title}</div>
              <div style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>{item.desc}</div>
            </div>
          </li>
        ))}
      </ul>

      <div style={{
        marginTop: '16px',
        backgroundColor: '#f7fbff',
        border: '1px solid #e3f0ff',
        borderRadius: '6px',
        padding: '12px'
      }}>
        <div style={{ color: '#3868d6', fontSize: '13px' }}>
          Tip: Remember your encryption key — it’s required to decrypt and delete files.
        </div>
      </div>
    </div>
  )
}