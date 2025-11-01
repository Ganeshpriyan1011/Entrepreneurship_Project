import { TableClient, TableEntity, odata, AzureNamedKeyCredential } from '@azure/data-tables'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const accountName = process.env.AZURE_STORAGE_ACCOUNT
const accountKey = process.env.AZURE_STORAGE_KEY

if (!connectionString && (!accountName || !accountKey)) {
  console.warn('Azure Table Storage env vars not fully set. Database operations will fail until configured.')
}

// Initialize table clients
let usersTable: TableClient
let filesTable: TableClient

export async function initializeTables() {
  try {
    if (connectionString) {
      usersTable = TableClient.fromConnectionString(connectionString, 'Users')
      filesTable = TableClient.fromConnectionString(connectionString, 'Files')
    } else if (accountName && accountKey) {
      const credential = new AzureNamedKeyCredential(accountName, accountKey)
      usersTable = new TableClient(`https://${accountName}.table.core.windows.net`, 'Users', credential)
      filesTable = new TableClient(`https://${accountName}.table.core.windows.net`, 'Files', credential)
    } else {
      throw new Error('Azure storage credentials not configured')
    }

    // Create tables if they don't exist
    await usersTable.createTable()
    await filesTable.createTable()
    
    console.log('Azure Table Storage initialized successfully')
  } catch (error) {
    console.error('Failed to initialize Azure Table Storage:', error)
    throw error
  }
}

export interface UserEntity extends TableEntity {
  partitionKey: string // 'users'
  rowKey: string // email
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface FileEntity extends TableEntity {
  partitionKey: string // userId
  rowKey: string // fileId
  userId: string
  blobName: string
  filename: string
  size: number
  mimeType: string
  salt: string
  iv: string
  keyHash?: string
  createdAt: string
  updatedAt: string
}

export class UserService {
  static async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      const entity = await usersTable.getEntity<UserEntity>('users', email)
      return entity
    } catch (error: any) {
      if (error.statusCode === 404) return null
      throw error
    }
  }

  static async create(email: string, passwordHash: string): Promise<UserEntity> {
    const now = new Date().toISOString()
    const user: UserEntity = {
      partitionKey: 'users',
      rowKey: email,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now
    }
    try {
      await usersTable.createEntity(user)
      return user
    } catch (error: any) {
      if (error.statusCode === 409) {
        throw new Error('User already exists')
      }
      console.error('Error creating user:', error)
      throw error
    }
  }

  static async findById(userId: string): Promise<UserEntity | null> {
    try {
      // Since rowKey is email, we need to search by custom userId field
      // For now, we'll use email as the identifier
      const entities = usersTable.listEntities<UserEntity>({
        queryOptions: { filter: odata`PartitionKey eq 'users'` }
      })
      
      for await (const entity of entities) {
        if (entity.rowKey === userId) {
          return entity
        }
      }
      return null
    } catch (error) {
      return null
    }
  }
}

export class FileService {
  static async findByUserId(userId: string): Promise<FileEntity[]> {
    const files: FileEntity[] = []
    const entities = filesTable.listEntities<FileEntity>({
      queryOptions: { filter: odata`PartitionKey eq ${userId}` }
    })
    
    for await (const entity of entities) {
      files.push(entity)
    }
    
    // Sort by createdAt descending
    return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  static async create(data: {
    userId: string
    blobName: string
    filename: string
    size: number
    mimeType: string
    salt: string
    iv: string
    keyHash?: string
  }): Promise<FileEntity> {
    const now = new Date().toISOString()
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const file: FileEntity = {
      partitionKey: data.userId,
      rowKey: fileId,
      userId: data.userId,
      blobName: data.blobName,
      filename: data.filename,
      size: data.size,
      mimeType: data.mimeType,
      salt: data.salt,
      iv: data.iv,
      keyHash: data.keyHash,
      createdAt: now,
      updatedAt: now
    }
    
    try {
      await filesTable.createEntity(file)
      return file
    } catch (error: any) {
      console.error('Error creating file:', error)
      throw error
    }
  }

  static async findByIdAndUserId(fileId: string, userId: string): Promise<FileEntity | null> {
    try {
      const entity = await filesTable.getEntity<FileEntity>(userId, fileId)
      return entity
    } catch (error: any) {
      if (error.statusCode === 404) return null
      throw error
    }
  }

  static async deleteByIdAndUserId(fileId: string, userId: string): Promise<void> {
    try {
      await filesTable.deleteEntity(userId, fileId)
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Already deleted or never existed; treat as success
        return
      }
      throw error
    }
  }
}