"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const express_validator_1 = require("express-validator");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const documentProcessingService_1 = require("../services/documentProcessingService");
const logger_1 = require("../utils/logger");
const promises_1 = __importDefault(require("fs/promises"));
const router = express_1.default.Router();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads/documents';
        try {
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        }
        catch (error) {
            cb(error, uploadDir);
        }
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const filename = `${(0, uuid_1.v4)()}${ext}`;
        cb(null, filename);
    }
});
// File filter for allowed types
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
    const allowedMimes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
        'image/tif'
    ];
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (allowedTypes.includes(ext) && allowedMimes.includes(mime)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only PDF, PNG, JPEG, and TIFF files are allowed'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    }
});
// Apply authentication to all routes
router.use(auth_1.authenticate);
// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Private
router.post('/upload', upload.single('document'), [
    (0, express_validator_1.body)('taxReturnId').isString().withMessage('Tax return ID is required'),
    (0, express_validator_1.body)('documentType').optional().isString()
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const { taxReturnId, documentType } = req.body;
    try {
        // Verify tax return ownership
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: {
                id: taxReturnId,
                userId: req.user.id
            }
        });
        if (!taxReturn) {
            // Clean up uploaded file
            await promises_1.default.unlink(req.file.path);
            return res.status(404).json({ error: 'Tax return not found' });
        }
        // Detect document type if not provided
        const detectedType = documentType || detectDocumentType(req.file.originalname);
        // Create document record
        const document = await database_1.prisma.document.create({
            data: {
                taxReturnId,
                fileName: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                filePath: req.file.path,
                documentType: detectedType,
                processingStatus: 'PENDING'
            }
        });
        logger_1.logger.info(`Document uploaded: ${document.id} for tax return ${taxReturnId}`);
        res.status(201).json({
            id: document.id,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            documentType: document.documentType,
            processingStatus: document.processingStatus,
            createdAt: document.createdAt
        });
    }
    catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            try {
                await promises_1.default.unlink(req.file.path);
            }
            catch (unlinkError) {
                logger_1.logger.error('Failed to clean up uploaded file:', unlinkError);
            }
        }
        logger_1.logger.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
}));
// @desc    Process document with OCR
// @route   POST /api/documents/:id/process
// @access  Private
router.post('/:id/process', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid document ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    try {
        // Get document and verify ownership
        const document = await database_1.prisma.document.findFirst({
            where: {
                id,
                taxReturn: {
                    userId: req.user.id
                }
            },
            include: {
                taxReturn: true
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (document.processingStatus === 'PROCESSING') {
            return res.status(400).json({ error: 'Document is already being processed' });
        }
        // Update status to processing
        await database_1.prisma.document.update({
            where: { id },
            data: { processingStatus: 'PROCESSING' }
        });
        // Set up Server-Sent Events for streaming response
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });
        // Send initial status
        res.write(`data: ${JSON.stringify({ status: 'processing', message: 'Starting document processing...' })}\n\n`);
        try {
            // Process document
            const result = await (0, documentProcessingService_1.processDocument)(document, (progress) => {
                res.write(`data: ${JSON.stringify({ status: 'progress', ...progress })}\n\n`);
            });
            // Update document with results
            await database_1.prisma.document.update({
                where: { id },
                data: {
                    processingStatus: 'COMPLETED',
                    ocrText: result.ocrText,
                    extractedData: result.extractedData,
                    updatedAt: new Date()
                }
            });
            // Send completion status
            res.write(`data: ${JSON.stringify({
                status: 'completed',
                extractedData: result.extractedData,
                message: 'Document processing completed successfully'
            })}\n\n`);
            logger_1.logger.info(`Document processed successfully: ${id}`);
        }
        catch (processingError) {
            // Update status to failed
            await database_1.prisma.document.update({
                where: { id },
                data: { processingStatus: 'FAILED' }
            });
            res.write(`data: ${JSON.stringify({
                status: 'error',
                message: 'Document processing failed',
                error: processingError instanceof Error ? processingError.message : 'Unknown error'
            })}\n\n`);
            logger_1.logger.error(`Document processing failed: ${id}`, processingError);
        }
        res.end();
    }
    catch (error) {
        logger_1.logger.error('Document processing endpoint error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
}));
// @desc    Get documents for tax return
// @route   GET /api/tax-returns/:id/documents
// @access  Private
router.get('/tax-returns/:id/documents', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid tax return ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    try {
        // Verify tax return ownership
        const taxReturn = await database_1.prisma.taxReturn.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!taxReturn) {
            return res.status(404).json({ error: 'Tax return not found' });
        }
        const documents = await database_1.prisma.document.findMany({
            where: { taxReturnId: id },
            select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSize: true,
                documentType: true,
                processingStatus: true,
                isVerified: true,
                extractedData: true,
                createdAt: true,
                updatedAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(documents);
    }
    catch (error) {
        logger_1.logger.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
}));
// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private
router.delete('/:id', [
    (0, express_validator_1.param)('id').isString().withMessage('Valid document ID required')
], (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    try {
        // Get document and verify ownership
        const document = await database_1.prisma.document.findFirst({
            where: {
                id,
                taxReturn: {
                    userId: req.user.id
                }
            }
        });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // Delete file from filesystem
        try {
            await promises_1.default.unlink(document.filePath);
        }
        catch (fileError) {
            logger_1.logger.warn(`Failed to delete file: ${document.filePath}`, fileError);
        }
        // Delete document record
        await database_1.prisma.document.delete({
            where: { id }
        });
        logger_1.logger.info(`Document deleted: ${id}`);
        res.json({ message: 'Document deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Document deletion error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
}));
// Helper function to detect document type from filename
function detectDocumentType(filename) {
    const name = filename.toLowerCase();
    if (name.includes('w-2') || name.includes('w2'))
        return 'W2';
    if (name.includes('1099-int'))
        return 'FORM_1099_INT';
    if (name.includes('1099-div'))
        return 'FORM_1099_DIV';
    if (name.includes('1099-misc'))
        return 'FORM_1099_MISC';
    if (name.includes('1099-nec'))
        return 'FORM_1099_NEC';
    if (name.includes('1099-r'))
        return 'FORM_1099_R';
    if (name.includes('1099-g'))
        return 'FORM_1099_G';
    if (name.includes('1098'))
        return 'FORM_1098';
    if (name.includes('5498'))
        return 'FORM_5498';
    if (name.includes('k-1') || name.includes('k1'))
        return 'SCHEDULE_K1';
    return 'UNKNOWN';
}
exports.default = router;
//# sourceMappingURL=documents.js.map