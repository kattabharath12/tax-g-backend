import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'

// Rate limiting middleware
export const createRateLimit = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

// General API rate limit
export const apiLimiter = createRateLimit(15 * 60 * 1000, 100) // 100 requests per 15 minutes

// Strict rate limit for auth endpoints
export const authLimiter = createRateLimit(15 * 60 * 1000, 5) // 5 requests per 15 minutes

// Document processing rate limit
export const documentLimiter = createRateLimit(60 * 60 * 1000, 10) // 10 documents per hour

// CORS middleware
export const corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  
  next()
}

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err)

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      details: err.message
    })
    return
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized'
    })
    return
  }

  if (err.code === 'P2002') { // Prisma unique constraint error
    res.status(409).json({
      error: 'Resource already exists'
    })
    return
  }

  if (err.code === 'P2025') { // Prisma record not found error
    res.status(404).json({
      error: 'Resource not found'
    })
    return
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
}
