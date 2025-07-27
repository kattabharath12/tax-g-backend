
import express from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireOwnership, AuthenticatedRequest } from '../lib/auth'
import { IncomeType } from '@prisma/client'
import { Decimal } from 'decimal.js'

const router = express.Router()

// Validation schemas
const createIncomeSchema = z.object({
  incomeType: z.nativeEnum(IncomeType),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  employerName: z.string().optional(),
  employerEIN: z.string().optional(),
  payerName: z.string().optional(),
  payerTIN: z.string().optional()
})

const updateIncomeSchema = z.object({
  incomeType: z.nativeEnum(IncomeType).optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  employerName: z.string().optional(),
  employerEIN: z.string().optional(),
  payerName: z.string().optional(),
  payerTIN: z.string().optional()
})

// GET /api/tax-returns/:id/income
router.get('/:id/income', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const incomeEntries = await prisma.incomeEntry.findMany({
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

    res.json(incomeEntries)
  } catch (error) {
    console.error('Error fetching income entries:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/tax-returns/:id/income
router.post('/:id/income', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createIncomeSchema.parse(req.body)

    const incomeEntry = await prisma.incomeEntry.create({
      data: {
        taxReturnId: req.params.id,
        incomeType: validatedData.incomeType,
        description: validatedData.description,
        amount: new Decimal(validatedData.amount),
        employerName: validatedData.employerName,
        employerEIN: validatedData.employerEIN,
        payerName: validatedData.payerName,
        payerTIN: validatedData.payerTIN
      },
      include: {
        extractedEntries: true
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(req.params.id)

    res.status(201).json(incomeEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error creating income entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/tax-returns/:id/income/:entryId
router.put('/:id/income/:entryId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updateIncomeSchema.parse(req.body)

    // Verify the income entry belongs to this tax return
    const existingEntry = await prisma.incomeEntry.findFirst({
      where: {
        id: req.params.entryId,
        taxReturnId: req.params.id
      }
    })

    if (!existingEntry) {
      return res.status(404).json({ error: 'Income entry not found' })
    }

    const updateData: any = {}
    if (validatedData.incomeType) updateData.incomeType = validatedData.incomeType
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.amount) updateData.amount = new Decimal(validatedData.amount)
    if (validatedData.employerName !== undefined) updateData.employerName = validatedData.employerName
    if (validatedData.employerEIN !== undefined) updateData.employerEIN = validatedData.employerEIN
    if (validatedData.payerName !== undefined) updateData.payerName = validatedData.payerName
    if (validatedData.payerTIN !== undefined) updateData.payerTIN = validatedData.payerTIN

    const incomeEntry = await prisma.incomeEntry.update({
      where: {
        id: req.params.entryId
      },
      data: updateData,
      include: {
        extractedEntries: true
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(req.params.id)

    res.json(incomeEntry)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors
      })
    }
    
    console.error('Error updating income entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/tax-returns/:id/income/:entryId
router.delete('/:id/income/:entryId', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    // Verify the income entry belongs to this tax return
    const existingEntry = await prisma.incomeEntry.findFirst({
      where: {
        id: req.params.entryId,
        taxReturnId: req.params.id
      }
    })

    if (!existingEntry) {
      return res.status(404).json({ error: 'Income entry not found' })
    }

    await prisma.incomeEntry.delete({
      where: {
        id: req.params.entryId
      }
    })

    // Recalculate tax totals
    await recalculateTaxTotals(req.params.id)

    res.json({ message: 'Income entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting income entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/tax-returns/:id/income/summary
router.get('/:id/income/summary', authenticateToken, requireOwnership, async (req: AuthenticatedRequest, res) => {
  try {
    const incomeEntries = await prisma.incomeEntry.findMany({
      where: {
        taxReturnId: req.params.id
      }
    })

    const summary = incomeEntries.reduce((acc, entry) => {
      const type = entry.incomeType
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

    const totalIncome = incomeEntries.reduce(
      (sum, entry) => sum.plus(entry.amount),
      new Decimal(0)
    )

    res.json({
      summary,
      totalIncome,
      totalEntries: incomeEntries.length
    })
  } catch (error) {
    console.error('Error fetching income summary:', error)
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
