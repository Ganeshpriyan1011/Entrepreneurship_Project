"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const storage_1 = require("./storage");
const auth_1 = __importDefault(require("./routes/auth"));
const files_1 = __importDefault(require("./routes/files"));
const app = (0, express_1.default)();
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
// Updated CORS configuration to handle Azure Blob Storage requests
app.use((0, cors_1.default)({
    origin: ORIGIN,
    credentials: true,
    exposedHeaders: ['x-ms-*']
}));
app.use(express_1.default.json({ limit: '20mb' }));
app.use((0, cookie_parser_1.default)());
app.use('/api/auth', auth_1.default);
app.use('/api/files', files_1.default);
app.get('/health', (_req, res) => res.json({ ok: true }));
const PORT = Number(process.env.PORT || 4000);
(0, storage_1.initializeTables)().then(() => {
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
}).catch((err) => {
    console.error('Azure Table Storage initialization failed', err);
    process.exit(1);
});
