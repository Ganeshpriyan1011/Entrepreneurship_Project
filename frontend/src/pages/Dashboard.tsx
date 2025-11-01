import React, { useEffect, useState } from 'react'
import { Files } from '../api/client'
import { encryptData, decryptData, toB64, fromB64, deriveKeyHash } from '../crypto/crypto'
import AzureIcon from '../components/AzureIcon'

// File type icons
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return '📷';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('text/')) return '📝';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📃';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📑';
  return '📁';
};

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function Dashboard({ api }: { api: { logout: () => void } }) {
  const [password, setPassword] = useState(() => {
    // Load encryption key from localStorage if available
    return localStorage.getItem('encryptionKey') || ''
  })
  const [files, setFiles] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [showDownloadKeyModal, setShowDownloadKeyModal] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [downloadKeyInput, setDownloadKeyInput] = useState('')
  const [fileToDownload, setFileToDownload] = useState<any>(null)
  const [rememberKey, setRememberKey] = useState(() => {
    // Default to true if key is already saved
    return localStorage.getItem('encryptionKey') ? true : false
  })
  
  // State for delete confirmation modal already defined above

  // Save encryption key to localStorage when it changes
  useEffect(() => {
    if (password && rememberKey) {
      localStorage.setItem('encryptionKey', password)
    }
  }, [password, rememberKey])

  async function refresh() {
    try {
      const res = await Files.list()
      // Only update if we got a valid response
      if (Array.isArray(res)) {
        setFiles(res)
      } else {
        setFiles(res || [])
        console.error('Invalid file list response:', res)
      }
    } catch (e: any) {
      showMessage(e.message, 'error')
      // Don't clear the files list on error to maintain state
    }
  }

  useEffect(() => {
    refresh()
    
    // Set up automatic refresh every 5 seconds
    const intervalId = setInterval(() => {
      refresh()
    }, 5000)
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId)
  }, [])

  const showMessage = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMsg(message)
    setMsgType(type)
    setTimeout(() => setMsg(null), 5000) // Auto-hide message after 5 seconds
  }

  async function onUpload(file: File) {
    if (!file) return
    if (!password) { 
      showMessage('Please enter your encryption key to encrypt the file', 'error')
      return 
    }
    
    setBusy(true)
    setMsg(null)
    try {
      // Show processing message
      showMessage('Encrypting and uploading file...', 'info')
      
      const buf = new Uint8Array(await file.arrayBuffer())
      const { ciphertext, iv, salt } = await encryptData(password, buf)
      const mimeType = file.type || 'application/octet-stream';
      const meta = await Files.create(file.name, ciphertext.byteLength, mimeType)
      
      try {
        await Files.proxyUpload(meta.uploadUrl, ciphertext, mimeType)
      } catch (uploadError: any) {
        console.error('Upload error:', uploadError);
        if (uploadError.code === 'ETIMEDOUT' || uploadError.message?.includes('timeout')) {
          throw new Error('Connection to storage timed out. Please check your internet connection and try again.');
        } else if (uploadError.code === 'ECONNRESET' || uploadError.code === 'ECONNABORTED') {
          throw new Error('Connection was reset. Please try again.');
        } else {
          throw uploadError;
        }
      }
      
      const keyHash = await deriveKeyHash(password, salt)
      const response = await Files.complete({
        blobName: meta.blobName,
        size: ciphertext.byteLength,
        mimeType: file.type || 'application/octet-stream',
        salt: toB64(salt),
        iv: toB64(iv),
        keyHash,
        filename: file.name
      })
      
      // Add the newly uploaded file to the files list immediately
      if (response && (response.id || response._id)) {
        // Create a temporary file object with the response data
        const newId = response.id || response._id
        const newFile = {
          _id: newId,
          id: newId,
          rowKey: newId,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          iv: toB64(iv),
          salt: toB64(salt),
          createdAt: new Date().toISOString(),
          size: ciphertext.byteLength
        }
        
        // Update the files list with the new file
        setFiles(prevFiles => [newFile, ...prevFiles])
      }
      
      await refresh()
      showMessage('File uploaded and encrypted successfully!', 'success')
    } catch (e: any) {
      console.error('Upload process error:', e);
      showMessage(e.message || 'An error occurred during upload. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onDownload(file: any) {
    // Always prompt for encryption key before download
    setFileToDownload(file)
    setDownloadKeyInput(password || '')
    setShowDownloadKeyModal(true)
  }
  
  // State for delete confirmation modal
  const [showDeleteKeyModal, setShowDeleteKeyModal] = useState(false)
  const [deleteKeyInput, setDeleteKeyInput] = useState('')
  const [fileToDelete, setFileToDelete] = useState<any>(null)

  // Handle file deletion request
  function onDelete(file: any) {
    // Always prompt for encryption key before delete
    setFileToDelete(file)
    setDeleteKeyInput(password || '')
    setShowDeleteKeyModal(true)
  }
  
  // Handle delete with key from modal
  const handleDeleteWithKey = () => {
    if (!deleteKeyInput || deleteKeyInput.trim() === '') {
      showMessage('Encryption key is required', 'error')
      return
    }
    
    // Save the key if remember is checked
    if (rememberKey) {
      localStorage.setItem('encryptionKey', deleteKeyInput)
      setPassword(deleteKeyInput)
    }
    
    // Close the modal and delete the file
    setShowDeleteKeyModal(false)
    deleteFile(fileToDelete, deleteKeyInput)
  }
  
  // Actual file deletion function
  async function deleteFile(file: any, key: string) {
    const fileId = file?.rowKey || file?._id || file?.id
    if (!file || !fileId) {
      showMessage('Invalid file information. Please refresh and try again.', 'error')
      return
    }
    
    setBusy(true)
    setMsg(null)
    
    try {
      // Validate the file exists
      const fileInfo = files.find(f => f.rowKey === fileId || f._id === fileId || f.id === fileId);
      if (!fileInfo) {
        throw new Error('File not found. It may have been deleted already.');
      }
      
      // Derive keyHash using the provided key and the file's salt
      const saltB64 = fileInfo.salt
      if (!saltB64) {
        throw new Error('Missing encryption metadata (salt). Cannot verify key.')
      }
      const keyHash = await deriveKeyHash(key, fromB64(saltB64))
      await Files.delete(fileId, keyHash)
      showMessage(`File "${file.filename}" deleted successfully`, 'success')
      // Remove the file from the list immediately
      setFiles(prevFiles => prevFiles.filter(f => (f.rowKey !== fileId && f._id !== fileId && f.id !== fileId)))
    } catch (e: any) {
      console.error('Delete error:', e)
      showMessage(e.message || 'Delete failed', 'error')
    } finally {
      setBusy(false)
      setShowDeleteKeyModal(false)
    }
  }
  
  // Function to handle the actual download with a provided key
  async function downloadFile(file: any, key: string) {
    // Validate encryption key
    if (!key || key.trim() === '') {
      showMessage('Encryption key is required', 'error')
      return
    }
    
    setBusy(true)
    setMsg(null)
    try {
      // Show processing message
      showMessage('Downloading and decrypting file...', 'info')
      
      console.log('Download file:', file);
      
      // Use the file directly if it has all the necessary information
      let fileInfo = file;
      
      // If file doesn't have necessary encryption metadata, try to find it in the files list
      if (!file.iv || !file.salt) {
        console.log('Looking up file in files list');
        // Try to find by id or _id
        const fileId = file.rowKey || file._id || file.id;
        if (!fileId) {
          console.error('No file ID available');
          throw new Error('Invalid file information. Please refresh and try again.');
        }
        
        fileInfo = files.find(f => f.rowKey === fileId || f._id === fileId || f.id === fileId);
        console.log('Found file info:', fileInfo);
      }
      
      if (!fileInfo || !fileInfo.iv || !fileInfo.salt) {
        console.error('Missing file information or encryption metadata');
        throw new Error('File information not found or incomplete. Please refresh and try again.');
      }
      
      // Resolve the correct file identifier (supports Azure Table rowKey and legacy id/_id)
      const resolvedId = file.rowKey || file._id || file.id;
      if (!resolvedId) {
        console.error('No valid file identifier found for download');
        throw new Error('Invalid file identifier. Please refresh and try again.');
      }
      const { downloadUrl } = await Files.downloadUrl(resolvedId)
      
      if (!downloadUrl) {
        throw new Error('Failed to get download URL. The file may no longer exist.');
      }
      
      let res;
      try {
        res = await Files.proxyDownload(downloadUrl)
      } catch (downloadError: any) {
        console.error('Download error:', downloadError);
        if (downloadError.code === 'ETIMEDOUT' || downloadError.message?.includes('timeout')) {
          throw new Error('Connection to storage timed out. Please check your internet connection and try again.');
        } else if (downloadError.code === 'ECONNRESET' || downloadError.code === 'ECONNABORTED') {
          throw new Error('Connection was reset. Please try again.');
        } else {
          throw downloadError;
        }
      }
      
      try {
        // Ensure we have a valid response
        if (!res || !res.data) {
          throw new Error('Received empty response from server');
        }
        
        // Convert the array data from the response to Uint8Array
        const data = new Uint8Array(Array.isArray(res.data) ? res.data : [])
        
        if (data.length === 0) {
          throw new Error('Received empty file data');
        }
        
        // Ensure we have valid IV and salt
        if (!fileInfo.iv || !fileInfo.salt) {
          throw new Error('Missing encryption metadata (IV or salt)');
        }
        
        // Decrypt the file data
        const pt = await decryptData(key, data, fromB64(fileInfo.iv), fromB64(fileInfo.salt))
        // Create a concrete ArrayBuffer to avoid SharedArrayBuffer typing
        const ab = new ArrayBuffer(pt.byteLength)
        new Uint8Array(ab).set(pt)
        const blob = new Blob([ab], { type: fileInfo.mimeType || 'application/octet-stream' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = fileInfo.filename || 'downloaded-file'
        a.click()
        URL.revokeObjectURL(a.href)
        showMessage('File decrypted and downloaded successfully!', 'success')
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        showMessage('Invalid encryption key. Please try again with the correct key.', 'error')
      }
    } catch (e: any) {
      console.error('Download process error:', e);
      showMessage(e.message || 'An error occurred during download. Please try again.', 'error')
    } finally {
      setBusy(false)
      setShowDownloadKeyModal(false)
    }
  }
  
  // Function to handle download with the key from modal
  function handleDownloadWithKey() {
    if (!downloadKeyInput || downloadKeyInput.trim() === '') {
      showMessage('Please enter your encryption key to decrypt the file', 'error')
      return
    }
    
    if (fileToDownload) {
      // If remember key is checked, save it
      if (rememberKey) {
        setPassword(downloadKeyInput)
        // Save to localStorage
        localStorage.setItem('encryptionKey', downloadKeyInput)
      }
      
      downloadFile(fileToDownload, downloadKeyInput)
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.currentTarget.value = ''
  }

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  // Handle drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="dashboard">
      {/* Info / Roadmap Section */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div 
            aria-label="Information" 
            title="Click to toggle roadmap details" 
            onClick={() => setShowRoadmap(!showRoadmap)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#eaf2ff',
              color: '#3868d6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >i</div>
          <div style={{ flex: 1 }}>
            <h3 
              className="card-title" 
              style={{ 
                margin: 0, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => setShowRoadmap(!showRoadmap)}
            >
              Roadmap and Future Ideas
              <span style={{ fontSize: '0.7em', color: '#666' }}>
                {showRoadmap ? '▼' : '▶'}
              </span>
            </h3>
            {showRoadmap && (
              <>
                <p className="muted" style={{ margin: '6px 0 12px 0' }}>We're actively improving Secure Azure Storage. Here are planned enhancements:</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f1' }}>
                    <strong>Virtual machine setup</strong> — optional Azure VM provisioning for private gateways and dedicated processing.
                  </li>
                  <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f1' }}>
                    <strong>Multi-factor authentication</strong> — expand beyond email OTP with TOTP apps and WebAuthn.
                  </li>
                  <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f1' }}>
                    <strong>Role-based access control</strong> — team roles and permissions for shared storage.
                  </li>
                  <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f1' }}>
                    <strong>Audit logs</strong> — detailed activity trails for uploads, downloads, and deletes.
                  </li>
                  <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f1' }}>
                    <strong>Key management</strong> — key backup/rotation with client-side re-encryption helpers.
                  </li>
                  <li style={{ padding: '8px 0' }}>
                    <strong>Performance & CDN</strong> — optional Azure CDN for faster global downloads.
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Download Key Modal */}
      {showDownloadKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0 }}>Enter Encryption Key</h3>
            <p>Please enter your encryption key to decrypt and download the file.</p>
            
            <div style={{ marginBottom: '15px' }}>
              <input
                type="password"
                placeholder="Encryption Key"
                value={downloadKeyInput}
                onChange={(e) => setDownloadKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginBottom: '10px'
                }}
              />
              
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginBottom: '15px' }}>
                <input
                  type="checkbox"
                  id="rememberDownloadKey"
                  checked={rememberKey}
                  onChange={(e) => setRememberKey(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                <label htmlFor="rememberDownloadKey">Remember this key for future downloads</label>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowDownloadKeyModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadWithKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Key Modal */}
      {showDeleteKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0 }}>Enter Encryption Key</h3>
            <p>Please enter your encryption key to delete the file.</p>
            
            <div style={{ marginBottom: '15px' }}>
              <input
                type="password"
                placeholder="Encryption Key"
                value={deleteKeyInput}
                onChange={(e) => setDeleteKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginBottom: '10px'
                }}
              />
              
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px', marginBottom: '15px' }}>
                <input
                  type="checkbox"
                  id="rememberDeleteKey"
                  checked={rememberKey}
                  onChange={(e) => setRememberKey(e.target.checked)}
                  style={{ marginRight: '5px' }}
                />
                <label htmlFor="rememberDeleteKey">Remember this key for future operations</label>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowDeleteKeyModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWithKey}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <input 
              type="password" 
              placeholder="Enter your encryption key" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{
                padding: '10px 15px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                width: '250px',
                fontSize: '14px'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#666' }}>
              <input 
                type="checkbox" 
                id="rememberKey" 
                checked={rememberKey} 
                onChange={(e) => setRememberKey(e.target.checked)} 
                style={{ marginRight: '5px' }}
              />
              <label htmlFor="rememberKey">Remember encryption key</label>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <button 
              style={{
                backgroundColor: '#4285F4',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '14px'
              }}
              onClick={() => document.getElementById('fileInput')?.click()}
              disabled={busy}
            >
              <span>Upload File</span>
            </button>
            <input 
              id="fileInput"
              type="file" 
              onChange={handleFileInputChange} 
              disabled={busy}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <button 
          onClick={api.logout} 
          style={{
            backgroundColor: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            padding: '8px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Log out
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div 
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: dragActive ? '2px dashed #4285F4' : '2px dashed #ddd',
          borderRadius: '8px',
          padding: '40px 20px',
          textAlign: 'center',
          marginBottom: '20px',
          backgroundColor: dragActive ? 'rgba(66, 133, 244, 0.05)' : '#f8f9fa',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
            <AzureIcon size={48} />
          </div>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Drag & Drop Files Here</h3>
          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
            or <span style={{ color: '#4285F4', fontWeight: 'bold' }}>browse</span> to upload
          </p>
          <p style={{ margin: '10px 0 0 0', color: '#999', fontSize: '12px' }}>
            All file formats are supported
          </p>
        </div>
      </div>

      {/* Status Message */}
      {msg && (
        <div style={{
          padding: '12px 15px',
          borderRadius: '4px',
          marginBottom: '20px',
          backgroundColor: msgType === 'success' ? '#d4edda' : msgType === 'error' ? '#f8d7da' : '#cce5ff',
          color: msgType === 'success' ? '#155724' : msgType === 'error' ? '#721c24' : '#004085',
          border: `1px solid ${msgType === 'success' ? '#c3e6cb' : msgType === 'error' ? '#f5c6cb' : '#b8daff'}`,
          fontSize: '14px'
        }}>
          {msg}
        </div>
      )}

      {/* Files Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, color: '#333', fontSize: '18px' }}>Your Files</h3>
          <button 
            onClick={refresh} 
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#4285F4',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            disabled={busy}
          >
            Refresh
          </button>
        </div>

        {files.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
            <p>No files uploaded yet. Upload your first encrypted file!</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 'normal', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>File</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 'normal', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>Size</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 'normal', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>Uploaded</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 'normal', color: '#666', fontSize: '14px', borderBottom: '1px solid #eee' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => (
                  <tr 
                    key={file._id || index} 
                    style={{ 
                      borderBottom: '1px solid #eee',
                      backgroundColor: selectedFile?._id === file._id ? 'rgba(66, 133, 244, 0.05)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedFile(file)}
                  >
                    <td style={{ padding: '12px 20px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{getFileIcon(file.mimeType)}</span>
                        <span style={{ wordBreak: 'break-word' }}>{file.filename}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', color: '#666', fontSize: '14px' }}>
                      {formatFileSize(file.size)}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#666', fontSize: '14px' }}>
                      {file.createdAt ? formatDate(file.createdAt) : 'Unknown'}
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(file);
                        }} 
                        disabled={busy}
                        style={{
                          backgroundColor: '#4285F4',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          marginRight: '8px'
                        }}
                      >
                        Download
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(file);
                        }} 
                        disabled={busy}
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {busy && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #4285F4',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 2s linear infinite',
              margin: '0 auto 15px'
            }} />
            <p style={{ color: '#333' }}>Processing your file...</p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  )
}
