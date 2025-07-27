
import express from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireOwnership, AuthenticatedRequest } from '../lib/auth'

const router = express.Router()

// Validation schemas
const createDependentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  ssn: z.string().optional(),
  relationship: z.string().min(1, 'Relationship is required'),
  birthDate: z.string().datetime().optional()
})

const updateDependentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  ssn: z.string().optional(),
  relationship: z.string().min(1, 'Relationship is required').optional(),
  birthDate: z.string().datetime().optional()
})

// GET /api/tax-returns/:id/dependents
router.get('/:id/dependents', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const dependents = await prisma.dependent.findMany({
      where: {
        taxReturnId: req.params.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    res.json(dependents)
  } catch (error) {
    console.error('Error fetching dependents:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/dependents
router.post('/:id/dependents', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createDependentSchema.parse(req.body)

    const dependent = await prisma.dependent.create({
      data: {
        taxReturnId: req.params.id,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        ssn: validatedData.ssn,
        relationship: validatedData.relationship,
        birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null
      }
    })

    // Recalculate tax totals (dependents affect credits)
    await recalculateTaxTotals(req.params.id)

    res.status(201).json(dependent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error creating dependent:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/tax-returns/:id/dependents/:dependentId
router.put('/:id/dependents/:dependentId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updateDependentSchema.parse(req.body)

    // Verify the dependent belongs to this tax return
    const existingDependent = await prisma.dependent.findFirst({
      where: {
        id: req.params.dependentId,
        taxReturnId: req.params.id
      }
    })

    if (!existingDependent) {
      return res.status(404).json({ error: 'Dependent not found' })
    }

    const updateData: any = {}
    if (validatedData.firstName) updateData.firstName = validatedData.firstName
    if (validatedData.lastName) updateData.lastName = validatedData.lastName
    if (validatedData.ssn !== undefined) updateData.ssn = validatedData.ssn
    if (validatedData.relationship) updateData.relationship = validatedData.relationship
    if (validatedData.birthDate !== undefined) {
      updateData.birthDate = validatedData.birthDate ? new Date(validatedData.birthDate) : null
    }

    const dependent = await prisma.dependent.update({
      where: {
        id: req.params.dependentId
      },
      data: updateData
    })

    // Recalculate tax totals
    await recalculateTaxTotals(req.params.id)

    res.json(dependent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error updating dependent:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/tax-returns/:id/dependents/:dependentId
router.delete('/:id/dependents/:dependentId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    // Verify the dependent belongs to this tax return
    const existingDependent = await prisma.dependent.findFirst({
      where: {
        id: req.params.dependentId,
        taxReturnId: req.params.id
      }
    })

    if (!existingDependent) {
      return res.status(404).json({ error: 'Dependent not found' })
    }

    await prisma.dependent.delete({
      where: {
        id: req.params.dependentId
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(req.params.id)

    res.json({ message: 'Dependent deleted successfully' })
  } catch (error) {
    console.error('Error deleting dependent:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to recalculate tax totals
async function recalculateTaxTotals(taxReturnId: string) {
  const { TaxCalculator } = await import('../lib/tax')
  
  const taxReturn = await prisma.taxReturn.findUnique({
    where: { id: taxReturnId },
    include: {
      incomeEntries: true,
      deductionEntries: true,
      dependents: true
    }
  })

  if (!taxReturn) return

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
      amountOwed: calculation.amountOwed,
      lastSavedAt: new Date()
    }
  })
}

export default router
