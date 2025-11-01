import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'data')
const OTPS_FILE = path.join(DATA_DIR, 'otps.json')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export interface OtpData {
  email: string
  code: string
  createdAt: string
  expiresAt: string
}

function readJsonFile<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (err) {
    console.warn('Error reading', filePath, err)
    return []
  }
}

function writeJsonFile<T>(filePath: string, data: T[]) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export class OtpService {
  static async create(email: string, code: string, ttlSeconds: number = 600): Promise<OtpData> {
    const otps = readJsonFile<OtpData>(OTPS_FILE)
    const now = new Date()
    const otp: OtpData = {
      email,
      code,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
    }
    const remaining = otps.filter(o => o.email !== email)
    remaining.push(otp)
    writeJsonFile(OTPS_FILE, remaining)
    return otp
  }

  static async verify(email: string, code: string): Promise<boolean> {
    const otps = readJsonFile<OtpData>(OTPS_FILE)
    const row = otps.find(o => o.email === email && o.code === code)
    if (!row) return false
    if (new Date(row.expiresAt).getTime() < Date.now()) return false
    const remaining = otps.filter(o => o.email !== email)
    writeJsonFile(OTPS_FILE, remaining)
    return true
  }
}