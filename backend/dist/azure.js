"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadSasUrl = getUploadSasUrl;
exports.getDownloadSasUrl = getDownloadSasUrl;
const storage_blob_1 = require("@azure/storage-blob");
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let accountName = process.env.AZURE_STORAGE_ACCOUNT;
let accountKey = process.env.AZURE_STORAGE_KEY;
const containerName = process.env.AZURE_CONTAINER_NAME;
// Parse connection string if provided
if (connectionString && !accountName) {
    const parts = connectionString.split(';');
    for (const part of parts) {
        if (part.startsWith('AccountName=')) {
            accountName = part.split('=')[1];
        }
        if (part.startsWith('AccountKey=')) {
            accountKey = part.split('=')[1];
        }
    }
}
if (!accountName || !accountKey || !containerName) {
    console.warn('Azure storage credentials not properly configured. SAS URL generation will fail.');
}
function getExpiry(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000);
}
function blobUrl(blobName) {
    return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(blobName)}`;
}
async function getUploadSasUrl(blobName, minutes = 10) {
    const creds = new storage_blob_1.StorageSharedKeyCredential(accountName, accountKey);
    const permissions = storage_blob_1.BlobSASPermissions.parse('cw'); // create + write
    const sas = (0, storage_blob_1.generateBlobSASQueryParameters)({
        containerName,
        blobName,
        permissions,
        protocol: storage_blob_1.SASProtocol.Https,
        expiresOn: getExpiry(minutes)
    }, creds).toString();
    return `${blobUrl(blobName)}?${sas}`;
}
async function getDownloadSasUrl(blobName, minutes = 10) {
    const creds = new storage_blob_1.StorageSharedKeyCredential(accountName, accountKey);
    const permissions = storage_blob_1.BlobSASPermissions.parse('r'); // read
    const sas = (0, storage_blob_1.generateBlobSASQueryParameters)({
        containerName,
        blobName,
        permissions,
        protocol: storage_blob_1.SASProtocol.Https,
        expiresOn: getExpiry(minutes)
    }, creds).toString();
    return `${blobUrl(blobName)}?${sas}`;
}
