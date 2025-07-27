"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const database_1 = require("../utils/database");
const taxCalculationService_1 = require("../services/taxCalculationService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Apply authentication to all routes
router.use(auth_1.authenticate);
// @desc    Get debug tax data
// @route   GET /api/debug/tax-data
// @access  Private (Development only)
router.get('/tax-data', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Debug endpoints not available in production' });
    }
    try {
        const taxReturns = await database_1.prisma.taxReturn.findMany({
            where: { userId: req.user.id },
            include: {
                incomeEntries: true,
                deductionEntries: true,
                dependents: true,
                documents: true
            }
        });
        const debugData = {
            user: req.user,
            taxReturns: taxReturns.map(tr => ({
                ...tr,
                calculatedTaxes: (0, taxCalculationService_1.calculateTaxes)(tr)
            })),
            systemInfo: {
                nodeEnv: process.env.NODE_ENV,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }
        };
        res.json(debugData);
    }
    catch (error) {
        logger_1.logger.error('Debug tax data error:', error);
        res.status(500).json({ error: 'Failed to fetch debug data' });
    }
}));
// @desc    Test tax calculations
// @route   POST /api/debug/test-calculations
// @access  Private (Development only)
router.post('/test-calculations', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Debug endpoints not available in production' });
    }
    const { taxReturnData } = req.body;
    try {
        const calculations = await (0, taxCalculationService_1.calculateTaxes)(taxReturnData);
        res.json({
            input: taxReturnData,
            calculations,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Test calculations error:', error);
        res.status(500).json({ error: 'Failed to test calculations' });
    }
}));
exports.default = router;
//# sourceMappingURL=debug.js.map