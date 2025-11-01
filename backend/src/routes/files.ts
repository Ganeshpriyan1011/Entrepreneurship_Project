import { Router } from 'express'
import { requireAuth, AuthedRequest } from '../middleware/auth'
import { File } from '../models/File'
import { getUploadSasUrl, getDownloadSasUrl } from '../azure'
import crypto from 'crypto'
import axios from 'axios'
import { BlobServiceClient } from '@azure/storage-blob'

const router = Router()

function randomId(n = 8) { return crypto.randomBytes(n).toString('hex') }

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const files = await File.findByUserId(req.userId!)
  // Do not expose keyHash to clients
  const sanitized = files.map((f: any) => {
    const { keyHash, ...rest } = f
    return rest
  })
  res.json(sanitized)
})

router.post('/create', requireAuth, async (req: AuthedRequest, res) => {
  const { filename, size, mimeType } = req.body || {}
  if (!filename || !size || !mimeType) return res.status(400).json({ error: 'filename, size, mimeType required' })
  const blobName = `${req.userId}/${Date.now()}-${randomId(6)}`
  const uploadUrl = await getUploadSasUrl(blobName, 10)
  return res.json({ uploadUrl, blobName })
})

router.post('/complete', requireAuth, async (req: AuthedRequest, res) => {
  const { blobName, size, mimeType, salt, iv, filename, keyHash } = req.body || {}
  if (!blobName || !size || !mimeType || !salt || !iv || !filename) return res.status(400).json({ error: 'missing fields' })
  const doc = await File.create({ userId: req.userId!, blobName, size, mimeType, salt, iv, filename, keyHash })
  res.json({ ok: true, id: doc.rowKey })
})

router.get('/:id/download', requireAuth, async (req: AuthedRequest, res) => {
  try {
    console.log(`Generating download URL for file ID: ${req.params.id}`)
    
    const file = await File.findByIdAndUserId(req.params.id, req.userId!)
    if (!file) {
      console.error(`File not found with ID: ${req.params.id}`)
      return res.status(404).json({ error: 'not found' })
    }

    // Validate that we have a blob name
    if (!file.blobName) {
      console.error(`File ${req.params.id} has no blobName`)
      return res.status(400).json({ error: 'Invalid file data - missing blob reference' })
    }

    const downloadUrl = await getDownloadSasUrl(file.blobName, 30) // Increased to 30 minutes
    console.log(`Generated download URL for ${file.blobName}`)
    
    res.json({ downloadUrl })
  } catch (error) {
    console.error('Error generating download URL:', error)
    return res.status(500).json({ error: 'Failed to generate download URL' })
  }
})

// Delete a file
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    console.log(`Deleting file with ID: ${req.params.id}`)
    
    const file = await File.findByIdAndUserId(req.params.id, req.userId!)
    if (!file) {
      console.error(`File not found with ID: ${req.params.id}`)
      return res.status(404).json({ error: 'File not found' })
    }

    // When keyHash is stored, require a matching keyHash from client
    const providedKeyHash = (req.body && (req.body as any).keyHash) || undefined
    if ((file as any).keyHash) {
      if (!providedKeyHash) {
        return res.status(400).json({ error: 'Encryption key required to delete this file' })
      }
      if (providedKeyHash !== (file as any).keyHash) {
        return res.status(403).json({ error: 'Invalid encryption key for deletion' })
      }
    }

    // Delete from Azure Blob Storage if blobName exists
    if (file.blobName) {
      try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!)
        const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME!)
        const blobClient = containerClient.getBlobClient(file.blobName)
        
        await blobClient.delete()
        console.log(`Deleted blob ${file.blobName} from Azure storage`)
      } catch (storageError) {
        console.error(`Error deleting blob from storage: ${storageError}`)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database (Azure Table Storage)
    await File.deleteByIdAndUserId(req.params.id, req.userId!)
    console.log(`Deleted file ${req.params.id} from database`)
    
    return res.status(200).json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting file:', error)
    return res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Proxy endpoint to handle Azure Blob Storage requests
router.post('/proxy-upload', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { url, data, mimeType } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })
    
    // Set up retry logic
    const maxRetries = 3;
    let retries = 0;
    let lastError = null;
    
    // Determine content type based on mimeType or default to octet-stream
    const contentType = mimeType || 'application/octet-stream';
    console.log(`Uploading file with content type: ${contentType}`);

    // Normalize incoming data to a Buffer for Azure
    let buffer: Buffer;
    try {
      if (data instanceof Buffer) {
        buffer = data as Buffer;
      } else if (Array.isArray(data)) {
        // JSON array of byte values
        buffer = Buffer.from(data);
      } else if (typeof data === 'string') {
        // Base64 string
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(data);
        buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(data);
      } else if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
        // Serialized Buffer
        buffer = Buffer.from(data.data);
      } else {
        throw new Error('Unsupported upload data format');
      }
    } catch (normErr: any) {
      console.error('Failed to normalize upload data to Buffer:', normErr);
      return res.status(400).json({ error: 'Invalid upload data format' });
    }
    
    while (retries < maxRetries) {
      try {
        const response = await axios.put(url, buffer, {
          headers: {
            'Content-Type': contentType,
            'x-ms-blob-type': 'BlockBlob'
          },
          timeout: 60000, // 60 second timeout for larger files
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        
        return res.status(response.status).json({ ok: true });
      } catch (err: any) {
        lastError = err;
        console.error(`Upload attempt ${retries + 1} failed:`, err.message);
        
        // Log more detailed error information
        if (err.response) {
          console.error('Error response:', {
            status: err.response.status,
            data: err.response.data
          });
        }
        
        // Only retry on timeout or network errors
        if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
          retries++;
          if (retries < maxRetries) {
            // Exponential backoff: wait longer between each retry
            const delay = 1000 * Math.pow(2, retries);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Don't retry on other types of errors
          break;
        }
      }
    }
    
    // If we got here, all retries failed
    console.error('All upload attempts failed:', lastError);
    return res.status(500).json({ 
      error: lastError?.message || 'Upload failed after multiple attempts',
      code: lastError?.code,
      details: lastError?.response?.data || 'No additional error details'
    });
  } catch (error: any) {
    console.error('Proxy upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed', code: error.code });
  }
})

// Proxy endpoint to handle Azure Blob Storage download requests
router.post('/proxy-download', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })
    
    console.log(`Attempting to download from URL: ${url}`)
    
    // Set up retry logic
    const maxRetries = 3;
    let retries = 0;
    let lastError = null;
    
    while (retries < maxRetries) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 120000, // 120 second timeout for larger files
          maxContentLength: Infinity
        });
        
        if (!response.data) {
          console.error('Empty response received from Azure')
          return res.status(404).json({ error: 'File not found or empty' })
        }
        
        const data = Array.from(new Uint8Array(response.data))
        console.log(`Successfully downloaded ${data.length} bytes`)
        
        return res.status(200).json({
          data: data,
          contentType: response.headers['content-type']
        });
      } catch (err: any) {
        lastError = err;
        console.error(`Download attempt ${retries + 1} failed:`, err.message);
        
        if (err.response && err.response.status === 404) {
          console.error('File not found in storage')
          return res.status(404).json({ error: 'File not found in storage' })
        }
        
        // Only retry on timeout or network errors
        if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
          retries++;
          if (retries < maxRetries) {
            // Exponential backoff: wait longer between each retry
            const delay = 1000 * Math.pow(2, retries);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Don't retry on other types of errors
          break;
        }
      }
    }
    
    // If we got here, all retries failed
    console.error('All download attempts failed:', lastError);
    return res.status(500).json({ 
      error: lastError?.message || 'Download failed after multiple attempts',
      code: lastError?.code
    });
  } catch (error: any) {
    console.error('Proxy download error:', error);
    return res.status(500).json({ error: `Failed to download file: ${error.message}`, code: error.code });
  }
})

export default router
