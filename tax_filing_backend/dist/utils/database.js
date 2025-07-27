"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ?? new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
// Handle graceful shutdown
process.on('beforeExit', async () => {
    logger_1.logger.info('Disconnecting from database...');
    await exports.prisma.$disconnect();
});
exports.default = exports.prisma;
//# sourceMappingURL=database.js.map