
import express from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireOwnership, AuthenticatedRequest } from '../lib/auth'
import { TaxCalculator } from '../lib/tax'
import { FilingStatus } from '@prisma/client'

const router = express.Router()

// Validation schemas
const createTaxReturnSchema = z.object({
  taxYear: z.number().min(2020).max(new Date().getFullYear()),
  filingStatus: z.nativeEnum(FilingStatus)
})

const updateTaxReturnSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  ssn: z.string().optional(),
  spouseFirstName: z.string().optional(),
  spouseLastName: z.string().optional(),
  spouseSsn: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  filingStatus: z.nativeEnum(FilingStatus).optional()
})

const autoSaveSchema = z.object({
  data: z.any(),
  step: z.number().optional()
})

const completeStepSchema = z.object({
  step: z.number().min(1).max(10)
})

// GET /api/tax-returns
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taxReturns = await prisma.taxReturn.findMany({
      where: {
        userId: req.user!.id
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true,
        documents: {
          select: {
            id: true,
            fileName: true,
            documentType: true,
            processingStatus: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    res.json(taxReturns)
  } catch (error) {
    console.error('Error fetching tax returns:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { taxYear, filingStatus } = createTaxReturnSchema.parse(req.body)

    // Check if user already has a tax return for this year
    const existingReturn = await prisma.taxReturn.findFirst({
      where: {
        userId: req.user!.id,
        taxYear
      }
    })

    if (existingReturn) {
      return res.status(409).json({
        error: 'Tax return for this year already exists'
      })
    }

    const taxReturn = await prisma.taxReturn.create({
      data: {
        userId: req.user!.id,
        taxYear,
        filingStatus,
        currentStep: 1,
        completedSteps: []
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true,
        documents: true
      }
    })

    res.status(201).json(taxReturn)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error creating tax return:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/tax-returns/:id
router.get('/:id', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const taxReturn = await prisma.taxReturn.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true,
        documents: {
          include: {
            extractedEntries: true
          }
        }
      }
    })

    if (!taxReturn) {
      return res.status(404).json({ error: 'Tax return not found' })
    }

    res.json(taxReturn)
  } catch (error) {
    console.error('Error fetching tax return:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/tax-returns/:id
router.put('/:id', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const updateData = updateTaxReturnSchema.parse(req.body)

    const taxReturn = await prisma.taxReturn.update({
      where: {
        id: req.params.id
      },
      data: {
        ...updateData,
        lastSavedAt: new Date()
      },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true,
        documents: true
      }
    })

    // Recalculate tax if income or deductions changed
    if (updateData.filingStatus) {
      await recalculateTax(req.params.id)
    }

    res.json(taxReturn)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error updating tax return:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/auto-save
router.post('/:id/auto-save', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, step } = autoSaveSchema.parse(req.body)

    const updateData: any = {
      lastSavedAt: new Date()
    }

    if (step) {
      updateData.currentStep = step
    }

    // Merge the form data with existing tax return data
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        updateData[key] = data[key]
      }
    })

    const taxReturn = await prisma.taxReturn.update({
      where: {
        id: req.params.id
      },
      data: updateData
    })

    res.json({
      message: 'Auto-save successful',
      lastSavedAt: taxReturn.lastSavedAt
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error auto-saving tax return:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/complete-step
router.post('/:id/complete-step', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const { step } = completeStepSchema.parse(req.body)

    const taxReturn = await prisma.taxReturn.findUnique({
      where: { id: req.params.id }
    })

    if (!taxReturn) {
      return res.status(404).json({ error: 'Tax return not found' })
    }

    const completedSteps = [...taxReturn.completedSteps]
    if (!completedSteps.includes(step)) {
      completedSteps.push(step)
    }

    const updatedTaxReturn = await prisma.taxReturn.update({
      where: {
        id: req.params.id
      },
      data: {
        completedSteps,
        currentStep: Math.max(taxReturn.currentStep, step + 1),
        lastSavedAt: new Date()
      }
    })

    res.json({
      message: 'Step completed successfully',
      completedSteps: updatedTaxReturn.completedSteps,
      currentStep: updatedTaxReturn.currentStep
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error completing step:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/calculate
router.post('/:id/calculate', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    await recalculateTax(req.params.id)
    
    const taxReturn = await prisma.taxReturn.findUnique({
      where: { id: req.params.id },
      include: {
        incomeEntries: true,
        deductionEntries: true,
        dependents: true
      }
    })

    res.json({
      message: 'Tax calculation completed',
      taxReturn
    })
  } catch (error) {
    console.error('Error calculating tax:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to recalculate tax
async function recalculateTax(taxReturnId: string) {
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: taxReturnId },
    include: {
      incomeEntries: true,
      deductionEntries: true,
      dependents: true
    }
  })

  if (!taxReturn) {
    throw new Error('Tax return not found')
  }

  const calculation = TaxCalculator.calculateTax({
    filingStatus: taxReturn.filingStatus,
    taxYear: taxReturn.taxYear,
    incomeEntries: taxReturn.incomeEntries,
    deductionEntries: taxReturn.deductionEntries,
    dependents: taxReturn.dependents.length
  })

  await prisma.taxReturn.update({
    where: { id: taxReturnId },
    data: {
      totalIncome: calculation.totalIncome,
      adjustedGrossIncome: calculation.adjustedGrossIncome,
      standardDeduction: calculation.standardDeduction,
      itemizedDeduction: calculation.itemizedDeduction,
      taxableIncome: calculation.taxableIncome,
      taxLiability: calculation.taxLiability,
      totalCredits: calculation.totalCredits,
      refundAmount: calculation.refundAmount,
      amountOwed: calculation.amountOwed
    }
  })
}

export default router
