
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Request, Response, NextFunction } from 'express'
import { prisma } from './prisma'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name?: string
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12)
}

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword)
}

export const generateToken = (payload: any): string => {
  return jwt.sign(payload, process.env.NEXTAUTH_SECRET || 'fallback-secret', {
    expiresIn: '7d'
  })
}

export const verifyToken = (token: string): any | null => {
  try {
    return jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret')
  } catch (error) {
    return null
  }
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    res.status(401).json({ error: 'Access token required' })
    return
  }

  try {
    const decoded = verifyToken(token)
    if (!decoded) {
      res.status(403).json({ error: 'Invalid token' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      res.status(403).json({ error: 'User not found' })
      return
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || undefined
    }
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' })
    return
  }
}

export const requireOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const { id: taxReturnId } = req.params
  const userId = req.user?.id

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const taxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: taxReturnId,
        userId: userId
      }
    })

    if (!taxReturn) {
      res.status(404).json({ error: 'Tax return not found or access denied' })
      return
    }

    next()
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
    return
  }
}
