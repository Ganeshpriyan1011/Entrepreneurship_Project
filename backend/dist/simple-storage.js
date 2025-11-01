"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = exports.UserService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const USERS_FILE = path_1.default.join(DATA_DIR, 'users.json');
const FILES_FILE = path_1.default.join(DATA_DIR, 'files.json');
// Ensure data directory exists
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
function readJsonFile(filePath) {
    try {
        if (!fs_1.default.existsSync(filePath)) {
            return [];
        }
        const data = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.warn(`Error reading ${filePath}:`, error);
        return [];
    }
}
function writeJsonFile(filePath, data) {
    try {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        throw error;
    }
}
class UserService {
    static async findByEmail(email) {
        const users = readJsonFile(USERS_FILE);
        return users.find(user => user.email === email) || null;
    }
    static async create(email, passwordHash) {
        const users = readJsonFile(USERS_FILE);
        // Check if user already exists
        if (users.find(user => user.email === email)) {
            throw new Error('User already exists');
        }
        const now = new Date().toISOString();
        const user = {
            email,
            passwordHash,
            createdAt: now,
            updatedAt: now
        };
        users.push(user);
        writeJsonFile(USERS_FILE, users);
        return user;
    }
    static async findById(userId) {
        // For simplicity, userId is email
        return this.findByEmail(userId);
    }
}
exports.UserService = UserService;
class FileService {
    static async findByUserId(userId) {
        const files = readJsonFile(FILES_FILE);
        return files
            .filter(file => file.userId === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    static async create(data) {
        const files = readJsonFile(FILES_FILE);
        const now = new Date().toISOString();
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const file = {
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
        };
        files.push(file);
        writeJsonFile(FILES_FILE, files);
        return file;
    }
    static async findByIdAndUserId(fileId, userId) {
        const files = readJsonFile(FILES_FILE);
        return files.find(file => file.id === fileId && file.userId === userId) || null;
    }
}
exports.FileService = FileService;
