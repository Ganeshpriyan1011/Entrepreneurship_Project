"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token)
            return res.status(401).json({ error: 'Unauthorized' });
        const secret = process.env.JWT_SECRET;
        if (!secret)
            return res.status(500).json({ error: 'Server misconfigured' });
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.userId = payload.sub;
        next();
    }
    catch (e) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}
