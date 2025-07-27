export interface TaxStrategy {
    category: string;
    title: string;
    description: string;
    potentialSavings: number;
    confidence: number;
    actionItems: string[];
    deadline?: string;
}
export declare function generateTaxStrategies(taxReturnData: any): Promise<TaxStrategy[]>;
export declare function optimizeTaxScenario(scenario: any): Promise<any>;
//# sourceMappingURL=aiOptimizationService.d.ts.map