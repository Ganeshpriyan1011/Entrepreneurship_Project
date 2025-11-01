import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const FILES_FILE = path.join(DATA_DIR, 'files.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export interface UserData {
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface FileData {
  id: string
  userId: string
  blobName: string
  filename: string
  size: number
  mimeType: string
  salt: string
  iv: string
  createdAt: string
  updatedAt: string
}

function readJsonFile<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) {
      return []
    }
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.warn(`Error reading ${filePath}:`, error)
    return []
  }
}

function writeJsonFile<T>(filePath: string, data: T[]) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
    throw error
  }
}

export class UserService {
  static async findByEmail(email: string): Promise<UserData | null> {
    const users = readJsonFile<UserData>(USERS_FILE)
    return users.find(user => user.email === email) || null
  }

  static async create(email: string, passwordHash: string): Promise<UserData> {
    const users = readJsonFile<UserData>(USERS_FILE)
    
    // Check if user already exists
    if (users.find(user => user.email === email)) {
      throw new Error('User already exists')
    }
    
    const now = new Date().toISOString()
    const user: UserData = {
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now
    }
    
    users.push(user)
    writeJsonFile(USERS_FILE, users)
    return user
  }

  static async findById(userId: string): Promise<UserData | null> {
    // For simplicity, userId is email
    return this.findByEmail(userId)
  }
}

export class FileService {
  static async findByUserId(userId: string): Promise<FileData[]> {
    const files = readJsonFile<FileData>(FILES_FILE)
    return files
      .filter(file => file.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  static async create(data: {
    userId: string
    blobName: string
    filename: string
    size: number
    mimeType: string
    salt: string
    iv: string
  }): Promise<FileData> {
    const files = readJsonFile<FileData>(FILES_FILE)
    
    const now = new Date().toISOString()
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const file: FileData = {
      id: fileId,
      userId: data.userId,
      blobName: data.blobName,
      filename: data.filename,
      size: data.size,
      mimeType: data.mimeType,
      salt: data.salt,
      iv: data.iv,
      createdAt: now,
      updatedAt: now
    }
    
    files.push(file)
    writeJsonFile(FILES_FILE, files)
    return file
  }

  static async findByIdAndUserId(fileId: string, userId: string): Promise<FileData | null> {
    const files = readJsonFile<FileData>(FILES_FILE)
    return files.find(file => file.id === fileId && file.userId === userId) || null
  }
}