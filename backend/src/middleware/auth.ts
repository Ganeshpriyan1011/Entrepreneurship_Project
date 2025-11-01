import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthedRequest extends Request { userId?: string }

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' })
    const payload = jwt.verify(token, secret) as any
    req.userId = payload.sub
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
