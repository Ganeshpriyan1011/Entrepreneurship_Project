const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || res.statusText)
  return data
}

export const Auth = {
  sendOtp(email: string) {
    return apiFetch('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) })
  },
  signup(email: string, password: string, otp?: string) {
    return apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, otp }) })
  },
  login(email: string, password: string) {
    return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  }
}

export const Files = {
  list() { return apiFetch('/api/files') },
  create(filename: string, size: number, mimeType: string) {
    return apiFetch('/api/files/create', { method: 'POST', body: JSON.stringify({ filename, size, mimeType }) })
  },
  complete(payload: any) {
    return apiFetch('/api/files/complete', { method: 'POST', body: JSON.stringify(payload) })
  },
  downloadUrl(id: string) {
    return apiFetch(`/api/files/${id}/download`)
  },
  proxyUpload(url: string, data: ArrayBuffer | Uint8Array, mimeType: string) {
    return apiFetch('/api/files/proxy-upload', { 
      method: 'POST', 
      body: JSON.stringify({ 
        url, 
        data: Array.from(new Uint8Array(data)),
        mimeType 
      }) 
    })
  },
  // Download a file via proxy
  async proxyDownload(url: string) {
    try {
      return await apiFetch('/api/files/proxy-download', {
        method: 'POST',
        body: JSON.stringify({ url })
      })
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        throw new Error('File not found in storage. It may have been deleted or moved.')
      }
      throw error
    }
  },
  // Delete a file
  delete(fileId: string, keyHash?: string) {
    return apiFetch(`/api/files/${fileId}`, {
      method: 'DELETE',
      body: JSON.stringify({ keyHash })
    })
  }
}
