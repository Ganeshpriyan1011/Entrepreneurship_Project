import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initializeTables } from './storage'
import authRoutes from './routes/auth'
import fileRoutes from './routes/files'

const app = express()

// ✅ Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173', // local dev
  'https://icy-bay-06d227600.3.azurestaticapps.net' // your deployed frontend
]

// ✅ Configure CORS safely
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        console.log(`✅ CORS allowed for origin: ${origin}`)
        callback(null, true)
      } else {
        console.log(`❌ CORS not allowed from origin: ${origin}`)
        callback(new Error(`CORS not allowed from origin: ${origin}`))
      }
    },
    credentials: true,
    exposedHeaders: ['x-ms-*']
  })
)

// ✅ Middleware
app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

// ✅ Routes
app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)

// ✅ Health check endpoint
app.get('/health', (_req, res) => res.json({ ok: true }))

// ✅ Start server — listen on all interfaces for Azure
const PORT = Number(process.env.PORT || 8080)

initializeTables()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ API listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('❌ Azure Table Storage initialization failed', err)
    process.exit(1)
  })
