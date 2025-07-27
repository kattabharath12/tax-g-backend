import { Decimal } from 'decimal.js';
import { TaxReturn, IncomeEntry, DeductionEntry, Dependent } from '@prisma/client';
export interface TaxReturnWithRelations extends TaxReturn {
    incomeEntries: IncomeEntry[];
    deductionEntries: DeductionEntry[];
    dependents: Dependent[];
}
export interface TaxCalculationResult {
    totalIncome: Decimal;
    adjustedGrossIncome: Decimal;
    standardDeduction: Decimal;
    itemizedDeduction: Decimal;
    taxableIncome: Decimal;
    taxLiability: Decimal;
    totalCredits: Decimal;
    refundAmount: Decimal;
    amountOwed: Decimal;
}
export declare function calculateTaxes(taxReturn: TaxReturnWithRelations): Promise<TaxCalculationResult>;
export declare function getTaxBrackets(filingStatus: string): {
    min: number;
    max: number;
    rate: number;
}[];
export declare function getStandardDeduction(filingStatus: string): Decimal;
//# sourceMappingURL=taxCalculationService.d.ts.map