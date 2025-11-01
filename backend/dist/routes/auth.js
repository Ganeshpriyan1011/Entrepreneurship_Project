"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password)
            return res.status(400).json({ error: 'email and password required' });
        const existing = await User_1.User.findByEmail(email);
        if (existing)
            return res.status(400).json({ error: 'email already in use' });
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await User_1.User.create(email, passwordHash);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password)
            return res.status(400).json({ error: 'email and password required' });
        const user = await User_1.User.findByEmail(email);
        if (!user)
            return res.status(401).json({ error: 'invalid credentials' });
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!ok)
            return res.status(401).json({ error: 'invalid credentials' });
        const secret = process.env.JWT_SECRET;
        if (!secret)
            return res.status(500).json({ error: 'Server misconfigured' });
        const token = jsonwebtoken_1.default.sign({}, secret, { subject: user.email, expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 3600 * 1000
        });
        return res.json({ ok: true, token });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
exports.default = router;
