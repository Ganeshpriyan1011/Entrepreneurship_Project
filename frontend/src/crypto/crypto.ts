export async function getKeyMaterial(password: string) {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  )
}

export async function deriveAesGcmKey(password: string, salt: Uint8Array) {
  const keyMaterial = await getKeyMaterial(password)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: (salt as unknown as BufferSource), iterations: 210000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function deriveKeyHash(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await getKeyMaterial(password)
  // Derive 256 bits using PBKDF2 and hash them to produce a stable verifier
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: (salt as unknown as BufferSource), iterations: 210000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashBuf = await crypto.subtle.digest('SHA-256', bits)
  return toB64(new Uint8Array(hashBuf))
}

export function randomBytes(len: number) {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return a
}

export async function encryptData(password: string, data: ArrayBuffer | Uint8Array | string) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveAesGcmKey(password, salt)
  const enc = new TextEncoder()
  const plain = typeof data === 'string' ? enc.encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: (iv as unknown as BufferSource) }, key, (plain as unknown as BufferSource))
  return { ciphertext: new Uint8Array(ct), iv, salt }
}

export async function decryptData(password: string, ciphertext: Uint8Array, iv: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  try {
    // Validate inputs
    if (!password || password.trim() === '') {
      throw new Error('Encryption key is required')
    }
    
    if (!iv || iv.length !== 12) {
      throw new Error('Invalid initialization vector')
    }
    
    if (!salt || salt.length !== 16) {
      throw new Error('Invalid salt value')
    }
    
    if (!ciphertext || ciphertext.length === 0) {
      throw new Error('No data to decrypt')
    }
    
    // Derive key from password and salt
    const key = await deriveAesGcmKey(password, salt)
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: (iv as unknown as BufferSource)
      },
      key,
      (ciphertext as unknown as BufferSource)
    )
    
    return new Uint8Array(decrypted)
  } catch (error: any) {
    // Provide more specific error message for incorrect key
    if (error.name === 'OperationError') {
      throw new Error('Invalid encryption key. Please check your key and try again.')
    }
    throw error
  }
}

export function toB64(a: Uint8Array) {
  let bin = ''
  a.forEach((b) => bin += String.fromCharCode(b))
  return btoa(bin)
}

export function fromB64(s: string) {
  const bin = atob(s)
  const a = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i)
  return a
}
