import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { prisma } from './lib/prisma'
import authRoutes from './routes/auth'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// API routes
app.use('/api/auth', authRoutes)

// Simple 404 handler
app.get('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  })
})

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`📚 API base URL: http://localhost:${PORT}/api`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...')
  await prisma.$disconnect()
  process.exit(0)
})

startServer()
