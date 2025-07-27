"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const aiOptimizationService_1 = require("../services/aiOptimizationService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Apply authentication to all routes
router.use(auth_1.authenticate);
// @desc    Get AI-powered tax optimization strategies
// @route   POST /api/ai/tax-strategies
// @access  Private
router.post('/tax-strategies', [
    (0, express_validator_1.body)('taxReturnData').isObject().withMessage('Tax return data is required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { taxReturnData } = req.body;
    try {
        logger_1.logger.info(`Generating tax strategies for user ${req.user.id}`);
        const strategies = await (0, aiOptimizationService_1.generateTaxStrategies)(taxReturnData);
        res.json({
            strategies,
            generatedAt: new Date().toISOString(),
            disclaimer: 'These are AI-generated suggestions and should not be considered professional tax advice. Please consult with a qualified tax professional.'
        });
    }
    catch (error) {
        logger_1.logger.error('Tax strategies generation error:', error);
        res.status(500).json({
            error: 'Failed to generate tax strategies',
            message: 'Our AI service is temporarily unavailable. Please try again later.'
        });
    }
}));
// @desc    Get tax optimization recommendations
// @route   POST /api/ai/optimize
// @access  Private
router.post('/optimize', [
    (0, express_validator_1.body)('scenario').isObject().withMessage('Tax scenario data is required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { scenario } = req.body;
    try {
        // Mock optimization response for now
        const optimizations = [
            {
                category: 'Deductions',
                recommendation: 'Consider maximizing your retirement contributions',
                potentialSavings: 1200,
                confidence: 0.85,
                explanation: 'Based on your income level, increasing 401(k) contributions could reduce your taxable income significantly.'
            },
            {
                category: 'Credits',
                recommendation: 'Explore education tax credits',
                potentialSavings: 800,
                confidence: 0.70,
                explanation: 'If you or your dependents are pursuing higher education, you may qualify for education credits.'
            },
            {
                category: 'Timing',
                recommendation: 'Consider tax-loss harvesting',
                potentialSavings: 500,
                confidence: 0.60,
                explanation: 'If you have investment losses, they can be used to offset capital gains.'
            }
        ];
        logger_1.logger.info(`Tax optimization generated for user ${req.user.id}`);
        res.json({
            optimizations,
            totalPotentialSavings: optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0),
            generatedAt: new Date().toISOString(),
            disclaimer: 'These are AI-generated suggestions and should not be considered professional tax advice.'
        });
    }
    catch (error) {
        logger_1.logger.error('Tax optimization error:', error);
        res.status(500).json({ error: 'Failed to generate optimization recommendations' });
    }
}));
exports.default = router;
//# sourceMappingURL=ai.js.map