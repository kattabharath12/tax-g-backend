
import { Decimal } from 'decimal.js'
import { FilingStatus, IncomeType, DeductionType } from '@prisma/client'

export interface TaxCalculationInput {
  filingStatus: FilingStatus
  taxYear: number
  incomeEntries: Array<{
    incomeType: IncomeType
    amount: Decimal
  }>
  deductionEntries: Array<{
    deductionType: DeductionType
    amount: Decimal
  }>
  dependents: number
}

export interface TaxCalculationResult {
  totalIncome: Decimal
  adjustedGrossIncome: Decimal
  standardDeduction: Decimal
  itemizedDeduction: Decimal
  taxableIncome: Decimal
  taxLiability: Decimal
  totalCredits: Decimal
  refundAmount: Decimal
  amountOwed: Decimal
}

export class TaxCalculator {
  private static TAX_BRACKETS_2023 = {
    [FilingStatus.SINGLE]: [
      { min: 0, max: 11000, rate: 0.10 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 578125, rate: 0.35 },
      { min: 578125, max: Infinity, rate: 0.37 }
    ],
    [FilingStatus.MARRIED_FILING_JOINTLY]: [
      { min: 0, max: 22000, rate: 0.10 },
      { min: 22000, max: 89450, rate: 0.12 },
      { min: 89450, max: 190750, rate: 0.22 },
      { min: 190750, max: 364200, rate: 0.24 },
      { min: 364200, max: 462500, rate: 0.32 },
      { min: 462500, max: 693750, rate: 0.35 },
      { min: 693750, max: Infinity, rate: 0.37 }
    ],
    [FilingStatus.MARRIED_FILING_SEPARATELY]: [
      { min: 0, max: 11000, rate: 0.10 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182100, rate: 0.24 },
      { min: 182100, max: 231250, rate: 0.32 },
      { min: 231250, max: 346875, rate: 0.35 },
      { min: 346875, max: Infinity, rate: 0.37 }
    ],
    [FilingStatus.HEAD_OF_HOUSEHOLD]: [
      { min: 0, max: 15700, rate: 0.10 },
      { min: 15700, max: 59850, rate: 0.12 },
      { min: 59850, max: 95350, rate: 0.22 },
      { min: 95350, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 578100, rate: 0.35 },
      { min: 578100, max: Infinity, rate: 0.37 }
    ]
  }

  private static STANDARD_DEDUCTIONS_2023 = {
    [FilingStatus.SINGLE]: 13850,
    [FilingStatus.MARRIED_FILING_JOINTLY]: 27700,
    [FilingStatus.MARRIED_FILING_SEPARATELY]: 13850,
    [FilingStatus.HEAD_OF_HOUSEHOLD]: 20800,
    [FilingStatus.QUALIFYING_SURVIVING_SPOUSE]: 27700
  }

  static calculateTax(input: TaxCalculationInput): TaxCalculationResult {
    // Calculate total income
    const totalIncome = input.incomeEntries.reduce(
      (sum, entry) => sum.plus(entry.amount),
      new Decimal(0)
    )

    // Calculate AGI (simplified - in reality, this involves more complex adjustments)
    const adjustedGrossIncome = this.calculateAGI(totalIncome, input.incomeEntries)

    // Calculate deductions
    const standardDeduction = new Decimal(
      this.STANDARD_DEDUCTIONS_2023[input.filingStatus] || 13850
    )
    
    const itemizedDeduction = input.deductionEntries.reduce(
      (sum, entry) => sum.plus(entry.amount),
      new Decimal(0)
    )

    // Use higher of standard or itemized deduction
    const deduction = Decimal.max(standardDeduction, itemizedDeduction)

    // Calculate taxable income
    const taxableIncome = Decimal.max(
      adjustedGrossIncome.minus(deduction),
      new Decimal(0)
    )

    // Calculate tax liability
    const taxLiability = this.calculateTaxLiability(taxableIncome, input.filingStatus)

    // Calculate credits (simplified)
    const totalCredits = this.calculateCredits(input.dependents, adjustedGrossIncome, input.filingStatus)

    // Calculate final amounts
    const netTax = Decimal.max(taxLiability.minus(totalCredits), new Decimal(0))
    const withheld = this.calculateWithheld(input.incomeEntries)
    
    const refundAmount = Decimal.max(withheld.minus(netTax), new Decimal(0))
    const amountOwed = Decimal.max(netTax.minus(withheld), new Decimal(0))

    return {
      totalIncome,
      adjustedGrossIncome,
      standardDeduction,
      itemizedDeduction,
      taxableIncome,
      taxLiability,
      totalCredits,
      refundAmount,
      amountOwed
    }
  }

  private static calculateAGI(totalIncome: Decimal, incomeEntries: any[]): Decimal {
    // Simplified AGI calculation
    // In reality, this would involve various adjustments like IRA contributions, student loan interest, etc.
    let agi = totalIncome

    // Apply some basic adjustments
    incomeEntries.forEach(entry => {
      if (entry.incomeType === IncomeType.UNEMPLOYMENT) {
        // Unemployment compensation might have special treatment
        // This is simplified
      }
    })

    return agi
  }

  private static calculateTaxLiability(taxableIncome: Decimal, filingStatus: FilingStatus): Decimal {
    const brackets = this.TAX_BRACKETS_2023[filingStatus as keyof typeof this.TAX_BRACKETS_2023] || this.TAX_BRACKETS_2023[FilingStatus.SINGLE]
    let tax = new Decimal(0)
    let remainingIncome = taxableIncome

    for (const bracket of brackets) {
      if (remainingIncome.lte(0)) break

      const bracketMin = new Decimal(bracket.min)
      const bracketMax = new Decimal(bracket.max === Infinity ? Number.MAX_SAFE_INTEGER : bracket.max)
      const bracketWidth = bracketMax.minus(bracketMin)
      
      const taxableInThisBracket = Decimal.min(remainingIncome, bracketWidth)
      const taxForBracket = taxableInThisBracket.times(bracket.rate)
      
      tax = tax.plus(taxForBracket)
      remainingIncome = remainingIncome.minus(taxableInThisBracket)
    }

    return tax
  }

  private static calculateCredits(dependents: number, agi: Decimal, filingStatus: FilingStatus): Decimal {
    let credits = new Decimal(0)

    // Child Tax Credit (simplified)
    const childTaxCredit = new Decimal(dependents * 2000)
    
    // Phase out based on AGI (simplified)
    const phaseOutThreshold = filingStatus === FilingStatus.MARRIED_FILING_JOINTLY 
      ? new Decimal(400000) 
      : new Decimal(200000)
    
    if (agi.gt(phaseOutThreshold)) {
      const phaseOutAmount = agi.minus(phaseOutThreshold).div(1000).floor().times(50)
      credits = credits.plus(Decimal.max(childTaxCredit.minus(phaseOutAmount), new Decimal(0)))
    } else {
      credits = credits.plus(childTaxCredit)
    }

    // Earned Income Tax Credit (simplified)
    if (agi.lt(50000) && dependents > 0) {
      const eitc = this.calculateEITC(agi, dependents, filingStatus)
      credits = credits.plus(eitc)
    }

    return credits
  }

  private static calculateEITC(agi: Decimal, dependents: number, filingStatus: FilingStatus): Decimal {
    // Simplified EITC calculation
    if (dependents === 0) return new Decimal(0)
    
    const maxCredit = dependents === 1 ? 3733 : dependents === 2 ? 6164 : 6935
    const phaseOutStart = filingStatus === FilingStatus.MARRIED_FILING_JOINTLY ? 25220 : 19330
    
    if (agi.lt(phaseOutStart)) {
      return new Decimal(maxCredit)
    }
    
    // Simplified phase-out
    const phaseOutRate = 0.2106
    const phaseOut = agi.minus(phaseOutStart).times(phaseOutRate)
    
    return Decimal.max(new Decimal(maxCredit).minus(phaseOut), new Decimal(0))
  }

  private static calculateWithheld(incomeEntries: any[]): Decimal {
    // This would typically come from W-2s and 1099s
    // For now, estimate based on income type
    let withheld = new Decimal(0)

    incomeEntries.forEach(entry => {
      if (entry.incomeType === IncomeType.W2_WAGES) {
        // Estimate 15% withholding for W-2 wages
        withheld = withheld.plus(entry.amount.times(0.15))
      } else if (entry.incomeType === IncomeType.INTEREST || entry.incomeType === IncomeType.DIVIDENDS) {
        // Estimate 10% withholding for investment income
        withheld = withheld.plus(entry.amount.times(0.10))
      }
    })

    return withheld
  }

  static validateTaxReturn(taxReturn: any): string[] {
    const errors: string[] = []

    if (!taxReturn.firstName) {
      errors.push('First name is required')
    }

    if (!taxReturn.lastName) {
      errors.push('Last name is required')
    }

    if (!taxReturn.ssn || !/^\d{3}-?\d{2}-?\d{4}$/.test(taxReturn.ssn)) {
      errors.push('Valid SSN is required')
    }

    if (taxReturn.filingStatus === FilingStatus.MARRIED_FILING_JOINTLY) {
      if (!taxReturn.spouseFirstName) {
        errors.push('Spouse first name is required for joint filing')
      }
      if (!taxReturn.spouseLastName) {
        errors.push('Spouse last name is required for joint filing')
      }
      if (!taxReturn.spouseSsn || !/^\d{3}-?\d{2}-?\d{4}$/.test(taxReturn.spouseSsn)) {
        errors.push('Valid spouse SSN is required for joint filing')
      }
    }

    if (!taxReturn.address) {
      errors.push('Address is required')
    }

    if (!taxReturn.city) {
      errors.push('City is required')
    }

    if (!taxReturn.state) {
      errors.push('State is required')
    }

    if (!taxReturn.zipCode || !/^\d{5}(-\d{4})?$/.test(taxReturn.zipCode)) {
      errors.push('Valid ZIP code is required')
    }

    return errors
  }
}
