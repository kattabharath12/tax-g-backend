"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const database_1 = require("../utils/database");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Please include a valid email'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    try {
        // Check if user already exists
        const existingUser = await database_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(12);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        // Create user
        const user = await database_1.prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });
        logger_1.logger.info(`New user registered: ${email}`);
        res.status(201).json({
            message: 'User created successfully',
            user
        });
    }
    catch (error) {
        logger_1.logger.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
}));
// @desc    Authenticate user & get token
// @route   POST /api/auth/signin
// @access  Public
router.post('/signin', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please include a valid email'),
    (0, express_validator_1.body)('password').exists().withMessage('Password is required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
        // Check for user
        const user = await database_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user || !user.password) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        // Check password
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        // Create JWT payload
        const payload = {
            id: user.id,
            email: user.email
        };
        // Sign token
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET, { expiresIn: '30d' });
        logger_1.logger.info(`User signed in: ${email}`);
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Signin error:', error);
        res.status(500).json({ error: 'Server error during authentication' });
    }
}));
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // This would typically use the authenticate middleware
    // For now, return a placeholder response
    res.json({ message: 'User profile endpoint - implement with authenticate middleware' });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map