
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireOwnership, AuthenticatedRequest } from '../lib/auth'
import { ocrService } from '../lib/ocr'
import { documentLimiter } from '../middleware/auth'
import { DocumentType, ProcessingStatus } from '@prisma/client'

const router = express.Router()

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']
  const fileExt = path.extname(file.originalname).toLowerCase()
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, JPEG, and TIFF files are allowed.'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// Validation schemas
const processDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType).optional()
})

// GET /api/tax-returns/:id/documents
router.get('/:id/documents', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: {
        taxReturnId: req.params.id
      },
      include: {
        extractedEntries: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    res.json(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/documents/upload
router.post('/upload', authenticateToken, documentLimiter, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { taxReturnId } = req.body

    if (!taxReturnId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Tax return ID is required' })
    }

    // Verify user owns the tax return
    const taxReturn = await prisma.taxReturn.findFirst({
      where: {
        id: taxReturnId,
        userId: req.user!.id
      }
    })

    if (!taxReturn) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Tax return not found or access denied' })
    }

    // Detect document type based on filename
    const documentType = detectDocumentType(req.file.originalname)

    const document = await prisma.document.create({
      data: {
        taxReturnId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        documentType,
        processingStatus: ProcessingStatus.PENDING
      }
    })

    res.status(201).json(document)
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError)
      }
    }
    
    console.error('Error uploading document:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/documents/:id
router.get('/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        taxReturn: {
          select: {
            userId: true
          }
        },
        extractedEntries: true
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify user owns the document
    if (document.taxReturn.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/documents/:id
router.delete('/documents/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        taxReturn: {
          select: {
            userId: true
          }
        }
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify user owns the document
    if (document.taxReturn.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Delete file from filesystem
    try {
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath)
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError)
    }

    // Delete from database
    await prisma.document.delete({
      where: {
        id: req.params.id
      }
    })

    res.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/documents/:id/process
router.post('/documents/:id/process', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        taxReturn: {
          select: {
            userId: true
          }
        }
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify user owns the document
    if (document.taxReturn.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      // Update status to processing
      await prisma.document.update({
        where: { id: req.params.id },
        data: { processingStatus: ProcessingStatus.PROCESSING }
      })

      sendEvent('status', { status: 'processing', message: 'Starting document processing...' })

      // Process document with OCR
      const result = await ocrService.processDocument(document.filePath, document.documentType)

      sendEvent('progress', { progress: 50, message: 'OCR processing completed' })

      // Save OCR results
      const updatedDocument = await prisma.document.update({
        where: { id: req.params.id },
        data: {
          processingStatus: ProcessingStatus.COMPLETED,
          ocrText: result.text,
          extractedData: result.extractedData
        }
      })

      sendEvent('progress', { progress: 75, message: 'Extracting structured data...' })

      // Create extracted entries for verification
      await createExtractedEntries(req.params.id, result.extractedData, result.confidence)

      sendEvent('progress', { progress: 100, message: 'Processing completed successfully' })
      sendEvent('completed', { 
        document: updatedDocument,
        extractedData: result.extractedData
      })

    } catch (processingError) {
      console.error('Document processing error:', processingError)
      
      await prisma.document.update({
        where: { id: req.params.id },
        data: { processingStatus: ProcessingStatus.FAILED }
      })

      sendEvent('error', { 
        message: 'Document processing failed',
        error: processingError instanceof Error ? processingError.message : 'Unknown error'
      })
    }

    res.end()
  } catch (error) {
    console.error('Error processing document:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/documents/:id/verify
router.post('/documents/:id/verify', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { extractedEntries, verificationNotes } = req.body

    const document = await prisma.document.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        taxReturn: {
          select: {
            userId: true
          }
        }
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Verify user owns the document
    if (document.taxReturn.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Update document verification status
    await prisma.document.update({
      where: { id: req.params.id },
      data: {
        isVerified: true,
        verifiedBy: req.user!.id,
        verificationNotes
      }
    })

    // Process accepted extracted entries
    for (const entry of extractedEntries) {
      if (entry.isAccepted) {
        await createIncomeOrDeductionEntry(document.taxReturnId, entry)
      }
    }

    res.json({ message: 'Document verification completed successfully' })
  } catch (error) {
    console.error('Error verifying document:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper functions
function detectDocumentType(filename: string): DocumentType {
  const lowerName = filename.toLowerCase()
  
  if (lowerName.includes('w-2') || lowerName.includes('w2')) {
    return DocumentType.W2
  } else if (lowerName.includes('1099-int')) {
    return DocumentType.FORM_1099_INT
  } else if (lowerName.includes('1099-div')) {
    return DocumentType.FORM_1099_DIV
  } else if (lowerName.includes('1099-misc')) {
    return DocumentType.FORM_1099_MISC
  } else if (lowerName.includes('1099-nec')) {
    return DocumentType.FORM_1099_NEC
  } else if (lowerName.includes('1099-r')) {
    return DocumentType.FORM_1099_R
  } else if (lowerName.includes('1099-g')) {
    return DocumentType.FORM_1099_G
  } else if (lowerName.includes('1098')) {
    return DocumentType.FORM_1098
  } else if (lowerName.includes('receipt')) {
    return DocumentType.RECEIPT
  } else if (lowerName.includes('statement')) {
    return DocumentType.STATEMENT
  }
  
  return DocumentType.UNKNOWN
}

async function createExtractedEntries(documentId: string, extractedData: any, confidence?: number) {
  const entries = []
  
  // Create extracted entries based on the data structure
  for (const [fieldName, value] of Object.entries(extractedData)) {
    if (value && typeof value === 'string' || typeof value === 'number') {
      entries.push({
        documentId,
        fieldName,
        extractedValue: String(value),
        confidence: confidence || 0.8,
        isAccepted: false
      })
    }
  }

  if (entries.length > 0) {
    await prisma.documentExtractedEntry.createMany({
      data: entries
    })
  }
}

async function createIncomeOrDeductionEntry(taxReturnId: string, entry: any) {
  // This is a simplified implementation
  // In a real application, you'd have more sophisticated logic to determine
  // whether an entry should be income or deduction based on the field name and document type
  
  if (entry.fieldName.includes('wages') || entry.fieldName.includes('income')) {
    // Create income entry
    await prisma.incomeEntry.create({
      data: {
        taxReturnId,
        incomeType: 'W2_WAGES', // This should be determined based on document type
        description: `Extracted from document: ${entry.fieldName}`,
        amount: parseFloat(entry.extractedValue) || 0
      }
    })
  } else if (entry.fieldName.includes('deduction') || entry.fieldName.includes('expense')) {
    // Create deduction entry
    await prisma.deductionEntry.create({
      data: {
        taxReturnId,
        deductionType: 'OTHER_DEDUCTIONS', // This should be determined based on field name
        description: `Extracted from document: ${entry.fieldName}`,
        amount: parseFloat(entry.extractedValue) || 0
      }
    })
  }
}

export default router
