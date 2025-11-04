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
  'http://localhost:5173',
  'https://icy-bay-06d227600.3.azurestaticapps.net'
]

// ✅ Setup CORS middleware globally
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed for origin: ${origin}`)
      callback(null, true)
    } else {
      console.log(`❌ CORS not allowed from origin: ${origin}`)
      callback(new Error(`CORS not allowed from origin: ${origin}`))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ms-*'],
  credentials: true,
  exposedHeaders: ['x-ms-*']
}

app.use(cors(corsOptions))

// ✅ Handle preflight requests explicitly
app.options('*', cors(corsOptions))

// ✅ Middleware
app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

// ✅ Routes
app.use('/api/auth', authRoutes)
app.use('/api/files', fileRoutes)

// ✅ Health check
app.get('/health', (_req, res) => res.json({ ok: true }))

// ✅ Start server
const PORT = Number(process.env.PORT || 8080)

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
