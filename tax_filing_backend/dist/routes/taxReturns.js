"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const taxCalculationService_1 = require("../services/taxCalculationService");
const logger_1 = require("../utils/logger");
const decimal_js_1 = require("decimal.js");
const router = express_1.default.Router();
// Apply authentication to all routes
router.use(auth_1.authenticate);
// @desc    Get all tax returns for user
// @route   GET /api/tax-returns
// @access  Private
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const taxReturns = await database_1.prisma.taxReturn.findMany({
        where: { userId: req.user.id },
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
        orderBy: { taxYear: 'desc' }
    });
    res.json(taxReturns);
}));
// @desc    Create new tax return
// @route   POST /api/tax-returns
// @access  Private
router.post('/', [
    (0, express_validator_1.body)('taxYear').isInt({ min: 2020, max: 2030 }).withMessage('Valid tax year required'),
    (0, express_validator_1.body)('filingStatus').isIn(['SINGLE', 'MARRIED_FILING_JOINTLY', 'MARRIED_FILING_SEPARATELY', 'HEAD_OF_HOUSEHOLD', 'QUALIFYING_SURVIVING_SPOUSE']).withMessage('Valid filing status required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { taxYear, filingStatus } = req.body;
    try {
        // Check if tax return already exists for this year
        const existingReturn = await database_1.prisma.taxReturn.findUnique({
            where: {
                userId_taxYear: {
                    userId: req.user.id,
                    taxYear: parseInt(taxYear)
                }
            }
        });
        if (existingReturn) {
            return res.status(400).json({ error: 'Tax return for this year already exists' });
        }
        // Create new tax return
        const taxReturn = await database_1.prisma.taxReturn.create({
            data: {
                userId: req.user.id,
                taxYear: parseInt(taxYear),
                filingStatus,
                standardDeduction: new decimal_js_1.Decimal(filingStatus === 'MARRIED_FILING_JOINTLY' ? 27700 : 13850) // 2023 values
            },
            include: {
                incomeEntries: true,
                deductionEntries: true,
                dependents: true,
                documents: true
            }
        });
        logger_1.logger.info(`New tax return created: ${taxReturn.id} for user ${req.user.id}`);
        res.status(201).json(taxReturn);
    }
    catch (error) {
        logger_1.logger.error('Tax return creation error:', error);
        res.status(500).json({ error: 'Failed to create tax return' });
    }
}));
// @desc    Get specific tax return
// @route   GET /api/tax-returns/:id
// @access  Private
router.get('/:id', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const taxReturn = await database_1.prisma.taxReturn.findFirst({
        where: {
            id,
            userId: req.user.id
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
                    isVerified: true,
                    createdAt: true
                }
            }
        }
    });
    if (!taxReturn) {
        return res.status(404).json({ error: 'Tax return not found' });
    }
    res.json(taxReturn);
}));
// @desc    Update tax return
// @route   PUT /api/tax-returns/:id
// @access  Private
router.put('/:id', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    try {
        // Verify ownership
        const existingReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!existingReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        // Update tax return
        const updatedReturn = await database_1.prisma.taxReturn.update({
            where: { id },
            data: {
                ...updateData,
                lastSavedAt: new Date(),
                updatedAt: new Date()
            },
            include: {
                incomeEntries: true,
                deductionEntries: true,
                dependents: true,
                documents: true
            }
        });
        // Recalculate taxes if income or deductions changed
        if (updateData.incomeEntries || updateData.deductionEntries) {
            const calculatedTaxes = await (0, taxCalculationService_1.calculateTaxes)(updatedReturn);
            const finalReturn = await database_1.prisma.taxReturn.update({
                where: { id },
                data: calculatedTaxes,
                include: {
                    incomeEntries: true,
                    deductionEntries: true,
                    dependents: true,
                    documents: true
                }
            });
            return res.json(finalReturn);
        }
        res.json(updatedReturn);
    }
    catch (error) {
        logger_1.logger.error('Tax return update error:', error);
        res.status(500).json({ error: 'Failed to update tax return' });
    }
}));
// @desc    Auto-save tax return data
// @route   POST /api/tax-returns/:id/auto-save
// @access  Private
router.post('/:id/auto-save', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const saveData = req.body;
    try {
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const updatedReturn = await database_1.prisma.taxReturn.update({
            where: { id },
            data: {
                ...saveData,
                lastSavedAt: new Date()
            },
            include: {
                incomeEntries: true,
                deductionEntries: true,
                dependents: true
            }
        });
        res.json({
            taxReturn: updatedReturn,
            savedAt: updatedReturn.lastSavedAt
        });
    }
    catch (error) {
        logger_1.logger.error('Auto-save error:', error);
        res.status(500).json({ error: 'Failed to auto-save' });
    }
}));
// @desc    Complete step and advance workflow
// @route   POST /api/tax-returns/:id/complete-step
// @access  Private
router.post('/:id/complete-step', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required'),
    (0, express_validator_1.body)('stepNumber').isInt({ min: 1, max: 7 }).withMessage('Valid step number required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { stepNumber, data } = req.body;
    try {
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        // Add step to completed steps if not already there
        const completedSteps = [...taxReturn.completedSteps];
        if (!completedSteps.includes(stepNumber)) {
            completedSteps.push(stepNumber);
        }
        // Update current step to next step
        const nextStep = Math.min(stepNumber + 1, 7);
        const updatedReturn = await database_1.prisma.taxReturn.update({
            where: { id },
            data: {
                ...data,
                completedSteps,
                currentStep: nextStep,
                isCompleted: completedSteps.length === 7,
                lastSavedAt: new Date()
            },
            include: {
                incomeEntries: true,
                deductionEntries: true,
                dependents: true
            }
        });
        logger_1.logger.info(`Step ${stepNumber} completed for tax return ${id}`);
        res.json(updatedReturn);
    }
    catch (error) {
        logger_1.logger.error('Complete step error:', error);
        res.status(500).json({ error: 'Failed to complete step' });
    }
}));
// Income entry routes
router.post('/:id/income', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required'),
    (0, express_validator_1.body)('incomeType').isIn(['W2_WAGES', 'INTEREST', 'DIVIDENDS', 'BUSINESS_INCOME', 'CAPITAL_GAINS', 'OTHER_INCOME', 'UNEMPLOYMENT', 'RETIREMENT_DISTRIBUTIONS', 'SOCIAL_SECURITY']).withMessage('Valid income type required'),
    (0, express_validator_1.body)('amount').isNumeric().withMessage('Valid amount required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const incomeData = req.body;
    try {
        // Verify ownership
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const incomeEntry = await database_1.prisma.incomeEntry.create({
            data: {
                ...incomeData,
                taxReturnId: id,
                amount: new decimal_js_1.Decimal(incomeData.amount)
            }
        });
        // Recalculate taxes
        const updatedReturn = await database_1.prisma.taxReturn.findUnique({
            where: { id },
            include: { incomeEntries: true, deductionEntries: true, dependents: true }
        });
        if (updatedReturn) {
            const calculatedTaxes = await (0, taxCalculationService_1.calculateTaxes)(updatedReturn);
            await database_1.prisma.taxReturn.update({
                where: { id },
                data: calculatedTaxes
            });
        }
        res.status(201).json(incomeEntry);
    }
    catch (error) {
        logger_1.logger.error('Income entry creation error:', error);
        res.status(500).json({ error: 'Failed to create income entry' });
    }
}));
router.put('/:id/income/:entryId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, entryId } = req.params;
    const updateData = req.body;
    try {
        // Verify ownership through tax return
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const updatedEntry = await database_1.prisma.incomeEntry.update({
            where: { id: entryId },
            data: {
                ...updateData,
                amount: updateData.amount ? new decimal_js_1.Decimal(updateData.amount) : undefined
            }
        });
        res.json(updatedEntry);
    }
    catch (error) {
        logger_1.logger.error('Income entry update error:', error);
        res.status(500).json({ error: 'Failed to update income entry' });
    }
}));
router.delete('/:id/income/:entryId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, entryId } = req.params;
    try {
        // Verify ownership through tax return
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        await database_1.prisma.incomeEntry.delete({
            where: { id: entryId }
        });
        res.json({ message: 'Income entry deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Income entry deletion error:', error);
        res.status(500).json({ error: 'Failed to delete income entry' });
    }
}));
// Deduction entry routes (similar pattern)
router.post('/:id/deductions', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required'),
    (0, express_validator_1.body)('deductionType').isIn(['MORTGAGE_INTEREST', 'STATE_LOCAL_TAXES', 'CHARITABLE_CONTRIBUTIONS', 'MEDICAL_EXPENSES', 'BUSINESS_EXPENSES', 'STUDENT_LOAN_INTEREST', 'IRA_CONTRIBUTIONS', 'OTHER_DEDUCTIONS']).withMessage('Valid deduction type required'),
    (0, express_validator_1.body)('amount').isNumeric().withMessage('Valid amount required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const deductionData = req.body;
    try {
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const deductionEntry = await database_1.prisma.deductionEntry.create({
            data: {
                ...deductionData,
                taxReturnId: id,
                amount: new decimal_js_1.Decimal(deductionData.amount)
            }
        });
        res.status(201).json(deductionEntry);
    }
    catch (error) {
        logger_1.logger.error('Deduction entry creation error:', error);
        res.status(500).json({ error: 'Failed to create deduction entry' });
    }
}));
router.put('/:id/deductions/:entryId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, entryId } = req.params;
    const updateData = req.body;
    try {
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const updatedEntry = await database_1.prisma.deductionEntry.update({
            where: { id: entryId },
            data: {
                ...updateData,
                amount: updateData.amount ? new decimal_js_1.Decimal(updateData.amount) : undefined
            }
        });
        res.json(updatedEntry);
    }
    catch (error) {
        logger_1.logger.error('Deduction entry update error:', error);
        res.status(500).json({ error: 'Failed to update deduction entry' });
    }
}));
router.delete('/:id/deductions/:entryId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, entryId } = req.params;
    try {
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: { id, userId: req.user.id }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        await database_1.prisma.deductionEntry.delete({
            where: { id: entryId }
        });
        res.json({ message: 'Deduction entry deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Deduction entry deletion error:', error);
        res.status(500).json({ error: 'Failed to delete deduction entry' });
    }
}));
exports.default = router;
//# sourceMappingURL=taxReturns.js.map