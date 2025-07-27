"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const errorHandler_1 = require("./errorHandler");
exports.authenticate = (0, errorHandler_1.asyncHandler)(async (req, res, next) => {
    let token;
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (for NextAuth compatibility)
    else if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';');
        const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('next-auth.session-token='));
        if (tokenCookie) {
            token = tokenCookie.split('=')[1];
        }
    }
    if (!token) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }
    try {
        // Verify JWT token
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET);
        // Get user from database
        const user = await database_1.prisma.user.findUnique({
            where: { id: decoded.id || decoded.sub },
            select: { id: true, email: true, name: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Not authorized, user not found' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Not authorized, token failed' });
    }
});
const authorize = (...roles) => {
    return (req, res, next) => {
        // For now, we don't have role-based access control
        // This can be extended later if needed
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.js.map