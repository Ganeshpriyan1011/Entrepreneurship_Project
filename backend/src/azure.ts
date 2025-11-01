import { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol, BlobServiceClient } from '@azure/storage-blob'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
let accountName = process.env.AZURE_STORAGE_ACCOUNT as string
let accountKey = process.env.AZURE_STORAGE_KEY as string
const containerName = process.env.AZURE_CONTAINER_NAME as string

// Parse connection string if provided
if (connectionString && !accountName) {
  const parts = connectionString.split(';')
  for (const part of parts) {
    if (part.startsWith('AccountName=')) {
      accountName = part.split('=')[1]
    }
    if (part.startsWith('AccountKey=')) {
      accountKey = part.split('=')[1]
    }
  }
}

if (!accountName || !accountKey || !containerName) {
  console.warn('Azure storage credentials not properly configured. SAS URL generation will fail.')
}

// Initialize the BlobServiceClient
let blobServiceClient: BlobServiceClient | null = null;
if (connectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
} else if (accountName && accountKey) {
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
}

// Ensure container exists
async function ensureContainerExists() {
  if (!blobServiceClient) {
    console.error('BlobServiceClient not initialized. Cannot create container.');
    return false;
  }
  
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const exists = await containerClient.exists();
    
    if (!exists) {
      console.log(`Container ${containerName} does not exist. Creating it...`);
      await containerClient.create();
      console.log(`Container ${containerName} created successfully.`);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring container exists:', error);
    return false;
  }
}

function getExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

function blobUrl(blobName: string) {
  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}`
}

export async function getUploadSasUrl(blobName: string, minutes = 10) {
  // Ensure container exists before generating SAS URL
  await ensureContainerExists();
  
  const creds = new StorageSharedKeyCredential(accountName, accountKey)
  const permissions = BlobSASPermissions.parse('cw') // create + write
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions,
    protocol: SASProtocol.Https,
    expiresOn: getExpiry(minutes)
  }, creds).toString()
  return `${blobUrl(blobName)}?${sas}`
}

export async function getDownloadSasUrl(blobName: string, minutes = 10) {
  // Ensure container exists before generating SAS URL
  await ensureContainerExists();
  
  const creds = new StorageSharedKeyCredential(accountName, accountKey)
  const permissions = BlobSASPermissions.parse('r') // read
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions,
    protocol: SASProtocol.Https,
    expiresOn: getExpiry(minutes)
  }, creds).toString()
  return `${blobUrl(blobName)}?${sas}`
}
