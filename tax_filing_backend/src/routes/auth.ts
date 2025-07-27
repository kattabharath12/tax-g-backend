
import express from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../lib/auth'

const router = express.Router()

// Validation schemas
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = signupSchema.parse(req.body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists'
      })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    })

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email })

    return res.status(201).json({
      message: 'User created successfully',
      user,
      token
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.issues
      })
    }
    
    console.error('Signup error:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Invalid credentials'
      })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      })
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email })

    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      token
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.issues
      })
    }
    
    console.error('Login error:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
})

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = verifyToken(token)

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    return res.json({ user })
  } catch (error) {
    console.error('Token verification error:', error)
    return res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
