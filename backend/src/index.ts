import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initializeTables } from './storage'
import authRoutes from './routes/auth'
import fileRoutes from './routes/files'

const app = express()

// Allow both local and deployed frontends
const allowedOrigins = [
  'http://localhost:5173',
  'https://icy-bay-06d227600.azurestaticapps.net' // your deployed frontend
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS not allowed from origin: ${origin}`))
      }
    },
    credentials: true,
    exposedHeaders: ['x-ms-*']
  })
)

app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)

// Simple health check endpoint
app.get('/health', (_req, res) => res.json({ ok: true }))

// ✅ Important fix: listen on all interfaces, not just localhost
const PORT = Number(process.env.PORT || 4000)
initializeTables()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`✅ API listening on port ${PORT}`)
    )
  })
  .catch((err) => {
    console.error('❌ Azure Table Storage initialization failed', err)
    process.exit(1)
  })
