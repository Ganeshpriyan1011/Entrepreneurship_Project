"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const File_1 = require("../models/File");
const azure_1 = require("../azure");
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
function randomId(n = 8) { return crypto_1.default.randomBytes(n).toString('hex'); }
router.get('/', auth_1.requireAuth, async (req, res) => {
    const files = await File_1.File.findByUserId(req.userId);
    res.json(files);
});
router.post('/create', auth_1.requireAuth, async (req, res) => {
    const { filename, size, mimeType } = req.body || {};
    if (!filename || !size || !mimeType)
        return res.status(400).json({ error: 'filename, size, mimeType required' });
    const blobName = `${req.userId}/${Date.now()}-${randomId(6)}`;
    const uploadUrl = await (0, azure_1.getUploadSasUrl)(blobName, 10);
    return res.json({ uploadUrl, blobName });
});
router.post('/complete', auth_1.requireAuth, async (req, res) => {
    const { blobName, size, mimeType, salt, iv, filename } = req.body || {};
    if (!blobName || !size || !mimeType || !salt || !iv || !filename)
        return res.status(400).json({ error: 'missing fields' });
    const doc = await File_1.File.create({ userId: req.userId, blobName, size, mimeType, salt, iv, filename });
    res.json({ ok: true, id: doc.rowKey });
});
router.get('/:id/download', auth_1.requireAuth, async (req, res) => {
    const file = await File_1.File.findByIdAndUserId(req.params.id, req.userId);
    if (!file)
        return res.status(404).json({ error: 'not found' });
    const downloadUrl = await (0, azure_1.getDownloadSasUrl)(file.blobName, 10);
    res.json({ downloadUrl });
});
// Proxy endpoint to handle Azure Blob Storage requests
router.post('/proxy-upload', auth_1.requireAuth, async (req, res) => {
    try {
        const { url, data } = req.body;
        if (!url)
            return res.status(400).json({ error: 'url required' });
        // Ensure payload is binary. Frontend may send Array<number> or base64 string.
        let binary;
        if (typeof data === 'string') {
            try {
                // Treat as base64-encoded data
                binary = Buffer.from(data, 'base64');
            }
            catch {
                // Fallback: treat as UTF-8 string
                binary = Buffer.from(data, 'utf8');
            }
        }
        else if (Array.isArray(data)) {
            // Convert numeric array to Buffer
            binary = Buffer.from(data);
        }
        else if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
            // Node Buffer JSON representation
            binary = Buffer.from(data.data);
        }
        else if (data instanceof Uint8Array) {
            binary = data;
        }
        if (!binary) {
            return res.status(400).json({ error: 'invalid data payload; expected base64 or byte array' });
        }
        // Set up retry logic
        const maxRetries = 3;
        let retries = 0;
        let lastError = null;
        while (retries < maxRetries) {
            try {
                const response = await axios_1.default.put(url, binary, {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'x-ms-blob-type': 'BlockBlob'
                    },
                    timeout: 30000, // 30 second timeout
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
                return res.status(response.status).json({ ok: true });
            }
            catch (err) {
                lastError = err;
                console.error(`Upload attempt ${retries + 1} failed:`, err.message);
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
                }
                else {
                    // Don't retry on other types of errors
                    break;
                }
            }
        }
        // If we got here, all retries failed
        console.error('All upload attempts failed:', lastError);
        return res.status(500).json({
            error: lastError?.message || 'Upload failed after multiple attempts',
            code: lastError?.code
        });
    }
    catch (error) {
        console.error('Proxy upload error:', error);
        return res.status(500).json({ error: error.message || 'Upload failed', code: error.code });
    }
});
// Proxy endpoint to handle Azure Blob Storage download requests
router.post('/proxy-download', auth_1.requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url)
            return res.status(400).json({ error: 'url required' });
        // Set up retry logic
        const maxRetries = 3;
        let retries = 0;
        let lastError = null;
        while (retries < maxRetries) {
            try {
                const response = await axios_1.default.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000, // 30 second timeout
                    maxContentLength: Infinity
                });
                return res.status(200).send({
                    data: Array.from(new Uint8Array(response.data)),
                    contentType: response.headers['content-type']
                });
            }
            catch (err) {
                lastError = err;
                console.error(`Download attempt ${retries + 1} failed:`, err.message);
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
                }
                else {
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
    }
    catch (error) {
        console.error('Proxy download error:', error);
        return res.status(500).json({ error: error.message || 'Download failed', code: error.code });
    }
});
exports.default = router;
