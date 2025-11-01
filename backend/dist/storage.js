"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = exports.UserService = void 0;
exports.initializeTables = initializeTables;
const data_tables_1 = require("@azure/data-tables");
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const accountName = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;
if (!connectionString && (!accountName || !accountKey)) {
    console.warn('Azure Table Storage env vars not fully set. Database operations will fail until configured.');
}
// Initialize table clients
let usersTable;
let filesTable;
async function initializeTables() {
    try {
        if (connectionString) {
            usersTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'Users');
            filesTable = data_tables_1.TableClient.fromConnectionString(connectionString, 'Files');
        }
        else if (accountName && accountKey) {
            const credential = new data_tables_1.AzureNamedKeyCredential(accountName, accountKey);
            usersTable = new data_tables_1.TableClient(`https://${accountName}.table.core.windows.net`, 'Users', credential);
            filesTable = new data_tables_1.TableClient(`https://${accountName}.table.core.windows.net`, 'Files', credential);
        }
        else {
            throw new Error('Azure storage credentials not configured');
        }
        // Create tables if they don't exist
        await usersTable.createTable();
        await filesTable.createTable();
        console.log('Azure Table Storage initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize Azure Table Storage:', error);
        throw error;
    }
}
class UserService {
    static async findByEmail(email) {
        try {
            const entity = await usersTable.getEntity('users', email);
            return entity;
        }
        catch (error) {
            if (error.statusCode === 404)
                return null;
            throw error;
        }
    }
    static async create(email, passwordHash) {
        const now = new Date().toISOString();
        const user = {
            partitionKey: 'users',
            rowKey: email,
            email,
            passwordHash,
            createdAt: now,
            updatedAt: now
        };
        try {
            await usersTable.createEntity(user);
            return user;
        }
        catch (error) {
            if (error.statusCode === 409) {
                throw new Error('User already exists');
            }
            console.error('Error creating user:', error);
            throw error;
        }
    }
    static async findById(userId) {
        try {
            // Since rowKey is email, we need to search by custom userId field
            // For now, we'll use email as the identifier
            const entities = usersTable.listEntities({
                queryOptions: { filter: (0, data_tables_1.odata) `PartitionKey eq 'users'` }
            });
            for await (const entity of entities) {
                if (entity.rowKey === userId) {
                    return entity;
                }
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
}
exports.UserService = UserService;
class FileService {
    static async findByUserId(userId) {
        const files = [];
        const entities = filesTable.listEntities({
            queryOptions: { filter: (0, data_tables_1.odata) `PartitionKey eq ${userId}` }
        });
        for await (const entity of entities) {
            files.push(entity);
        }
        // Sort by createdAt descending
        return files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    static async create(data) {
        const now = new Date().toISOString();
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const file = {
            partitionKey: data.userId,
            rowKey: fileId,
            userId: data.userId,
            blobName: data.blobName,
            filename: data.filename,
            size: data.size,
            mimeType: data.mimeType,
            salt: data.salt,
            iv: data.iv,
            createdAt: now,
            updatedAt: now
        };
        try {
            await filesTable.createEntity(file);
            return file;
        }
        catch (error) {
            console.error('Error creating file:', error);
            throw error;
        }
    }
    static async findByIdAndUserId(fileId, userId) {
        try {
            const entity = await filesTable.getEntity(userId, fileId);
            return entity;
        }
        catch (error) {
            if (error.statusCode === 404)
                return null;
            throw error;
        }
    }
}
exports.FileService = FileService;
