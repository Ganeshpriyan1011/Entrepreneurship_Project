import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initializeTables } from './storage'
import authRoutes from './routes/auth'
import fileRoutes from './routes/files'

const app = express()

const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
// Updated CORS configuration to handle Azure Blob Storage requests
app.use(cors({
  origin: ORIGIN,
  credentials: true,
  exposedHeaders: ['x-ms-*']
}))
app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)

app.get('/health', (_req, res) => res.json({ ok: true }))

const PORT = Number(process.env.PORT || 4000)
initializeTables().then(() => {
  app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`))
}).catch((err) => {
  console.error('Azure Table Storage initialization failed', err)
  process.exit(1)
})
