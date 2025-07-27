import express from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireOwnership, AuthenticatedRequest } from '../lib/auth'
import { DeductionType } from '@prisma/client'
import { Decimal } from 'decimal.js'

const router = express.Router()

// Validation schemas
const createDeductionSchema = z.object({
  deductionType: z.nativeEnum(DeductionType),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive')
})

const updateDeductionSchema = z.object({
  deductionType: z.nativeEnum(DeductionType).optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional()
})

// GET /api/tax-returns/:id/deductions
router.get('/:id/deductions', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const deductionEntries = await prisma.deductionEntry.findMany({
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

    res.json(deductionEntries)
  } catch (error) {
    console.error('Error fetching deduction entries:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/deductions
router.post('/:id/deductions', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createDeductionSchema.parse(req.body)
    const taxReturnId = req.params.id

    if (!taxReturnId) {
      res.status(400).json({ error: 'Tax return ID is required' })
      return
    }

    const deductionEntry = await prisma.deductionEntry.create({
      data: {
        taxReturnId: taxReturnId,
        deductionType: validatedData.deductionType,
        description: validatedData.description,
        amount: new Decimal(validatedData.amount)
      },
      include: {
        extractedEntries: true
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(taxReturnId)

    res.status(201).json(deductionEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.issues
      })
      return
    }
    
    console.error('Error creating deduction entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/tax-returns/:id/deductions/:entryId
router.put('/:id/deductions/:entryId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updateDeductionSchema.parse(req.body)
    const taxReturnId = req.params.id
    const entryId = req.params.entryId

    if (!taxReturnId || !entryId) {
      res.status(400).json({ error: 'Tax return ID and entry ID are required' })
      return
    }

    // Verify the deduction entry belongs to this tax return
    const existingEntry = await prisma.deductionEntry.findFirst({
      where: {
        id: entryId,
        taxReturnId: taxReturnId
      }
    })

    if (!existingEntry) {
      res.status(404).json({ error: 'Deduction entry not found' })
      return
    }

    const updateData: any = {}
    if (validatedData.deductionType) updateData.deductionType = validatedData.deductionType
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.amount) updateData.amount = new Decimal(validatedData.amount)

    const deductionEntry = await prisma.deductionEntry.update({
      where: {
        id: entryId
      },
      data: updateData,
      include: {
        extractedEntries: true
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(taxReturnId)

    res.json(deductionEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.issues
      })
      return
    }
    
    console.error('Error updating deduction entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/tax-returns/:id/deductions/:entryId
router.delete('/:id/deductions/:entryId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const taxReturnId = req.params.id
    const entryId = req.params.entryId

    if (!taxReturnId || !entryId) {
      res.status(400).json({ error: 'Tax return ID and entry ID are required' })
      return
    }

    // Verify the deduction entry belongs to this tax return
    const existingEntry = await prisma.deductionEntry.findFirst({
      where: {
        id: entryId,
        taxReturnId: taxReturnId
      }
    })

    if (!existingEntry) {
      res.status(404).json({ error: 'Deduction entry not found' })
      return
    }

    await prisma.deductionEntry.delete({
      where: {
        id: entryId
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(taxReturnId)

    res.json({ message: 'Deduction entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting deduction entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/tax-returns/:id/deductions/summary
router.get('/:id/deductions/summary', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const deductionEntries = await prisma.deductionEntry.findMany({
      where: {
        taxReturnId: req.params.id
      }
    })

    const summary = deductionEntries.reduce((acc, entry) => {
      const type = entry.deductionType
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          total: new Decimal(0)
        }
      }
      acc[type].count += 1
      acc[type].total = acc[type].total.plus(entry.amount)
      return acc
    }, {} as Record<string, { count: number; total: Decimal }>)

    const totalDeductions = deductionEntries.reduce(
      (sum, entry) => sum.plus(entry.amount),
      new Decimal(0)
    )

    // Get standard deduction for comparison
    const taxReturn = await prisma.taxReturn.findUnique({
      where: { id: req.params.id },
      select: { filingStatus: true, standardDeduction: true }
    })

    res.json({
      summary,
      totalItemizedDeductions: totalDeductions,
      standardDeduction: taxReturn?.standardDeduction || new Decimal(0),
      shouldItemize: totalDeductions.gt(taxReturn?.standardDeduction || 0),
      totalEntries: deductionEntries.length
    })
  } catch (error) {
    console.error('Error fetching deduction summary:', error)
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
