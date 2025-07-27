
# Tax Filing Backend API

A comprehensive backend API for a tax filing application built with Node.js, Express, TypeScript, Prisma, and PostgreSQL.

## Features

- **Complete REST API** with 20+ endpoints for tax filing operations
- **Authentication & Authorization** using JWT tokens and NextAuth.js compatibility
- **Document Processing** with OCR capabilities (Google Document AI + LLM fallback)
- **Tax Calculations** with comprehensive algorithms for federal tax liability
- **Database Management** using Prisma ORM with PostgreSQL
- **File Upload & Management** with support for PDF, PNG, JPEG, TIFF documents
- **Rate Limiting & Security** with helmet, CORS, and request validation
- **Auto-save Functionality** for tax return progress
- **Real-time Document Processing** with Server-Sent Events

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens (NextAuth.js compatible)
- **File Processing**: Multer for uploads, Google Document AI for OCR
- **Validation**: Zod for request validation
- **Security**: Helmet, CORS, rate limiting
- **Development**: ts-node-dev for hot reloading

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- (Optional) Google Cloud Document AI setup
- (Optional) Abacus.AI API key for LLM fallback

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd tax_filing_backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and other settings
   ```

3. **Set up the database**:
   ```bash
   # Run database migrations
   npm run db:migrate

   # Generate Prisma client
   npm run db:generate

   # (Optional) Seed with sample data
   npm run db:seed
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tax_filing_db"

# Server
PORT=3001
FRONTEND_URL="http://localhost:3000"

# Authentication
NEXTAUTH_SECRET="your-super-secret-jwt-key"
```

### Optional Variables

```bash
# LLM API (for document processing fallback)
ABACUSAI_API_KEY="your-api-key"

# Google Document AI (for enhanced OCR)
GOOGLE_CLOUD_PROJECT_ID="your-project-id"
GOOGLE_CLOUD_W2_PROCESSOR_ID="processor-id"
GOOGLE_CLOUD_1099_PROCESSOR_ID="processor-id"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Token verification

### Tax Returns
- `GET /api/tax-returns` - List user's tax returns
- `POST /api/tax-returns` - Create new tax return
- `GET /api/tax-returns/:id` - Get specific tax return
- `PUT /api/tax-returns/:id` - Update tax return
- `POST /api/tax-returns/:id/auto-save` - Auto-save progress
- `POST /api/tax-returns/:id/complete-step` - Mark step as completed
- `POST /api/tax-returns/:id/calculate` - Recalculate taxes

### Income Management
- `GET /api/tax-returns/:id/income` - List income entries
- `POST /api/tax-returns/:id/income` - Create income entry
- `PUT /api/tax-returns/:id/income/:entryId` - Update income entry
- `DELETE /api/tax-returns/:id/income/:entryId` - Delete income entry
- `GET /api/tax-returns/:id/income/summary` - Income summary

### Deductions Management
- `GET /api/tax-returns/:id/deductions` - List deduction entries
- `POST /api/tax-returns/:id/deductions` - Create deduction entry
- `PUT /api/tax-returns/:id/deductions/:entryId` - Update deduction entry
- `DELETE /api/tax-returns/:id/deductions/:entryId` - Delete deduction entry
- `GET /api/tax-returns/:id/deductions/summary` - Deductions summary

### Document Management
- `GET /api/tax-returns/:id/documents` - List documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/process` - Process document with OCR
- `POST /api/documents/:id/verify` - Verify extracted data

### Dependents Management
- `GET /api/tax-returns/:id/dependents` - List dependents
- `POST /api/tax-returns/:id/dependents` - Add dependent
- `PUT /api/tax-returns/:id/dependents/:dependentId` - Update dependent
- `DELETE /api/tax-returns/:id/dependents/:dependentId` - Delete dependent

## Database Schema

The application uses a comprehensive database schema with the following main models:

- **User** - User accounts with authentication
- **TaxReturn** - Tax return records with filing information
- **IncomeEntry** - Income entries (W-2, 1099, etc.)
- **DeductionEntry** - Deduction entries (mortgage, charitable, etc.)
- **Document** - Uploaded tax documents with OCR processing
- **Dependent** - Dependent information for tax credits
- **DocumentExtractedEntry** - OCR extracted data for verification

## Document Processing Workflow

1. **Upload**: Documents are uploaded via multipart form data
2. **Storage**: Files are stored in the local filesystem with unique names
3. **OCR Processing**: 
   - Primary: Google Document AI (if configured)
   - Fallback: Abacus.AI LLM with vision capabilities
4. **Data Extraction**: Structured data extraction based on document type
5. **Verification**: Users can review and accept/reject extracted data
6. **Integration**: Accepted data is converted to income/deduction entries

## Tax Calculation Engine

The application includes a comprehensive tax calculation engine that handles:

- **Federal Tax Brackets** for all filing statuses
- **Standard vs Itemized Deductions** comparison
- **Tax Credits** including Child Tax Credit and EITC
- **Withholding Calculations** from W-2 and 1099 forms
- **Refund/Amount Owed** determination

## Security Features

- **JWT Authentication** with secure token generation
- **Password Hashing** using bcryptjs with salt rounds
- **Rate Limiting** on API endpoints (especially auth and document processing)
- **Input Validation** using Zod schemas
- **File Upload Security** with type and size validation
- **CORS Configuration** for cross-origin requests
- **Helmet Security Headers** for additional protection

## Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed database with sample data
npm run db:reset     # Reset database (destructive)
npm run db:studio    # Open Prisma Studio
```

## Production Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set production environment variables**:
   ```bash
   NODE_ENV=production
   DATABASE_URL="your-production-database-url"
   # ... other production settings
   ```

3. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

## API Testing

The API includes a health check endpoint for monitoring:

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Error Handling

The API provides consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (in development)"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Contributing

1. Follow TypeScript best practices
2. Use Prisma for all database operations
3. Validate all inputs with Zod schemas
4. Include proper error handling
5. Add appropriate rate limiting for new endpoints
6. Update this README for any new features

## License

This project is licensed under the ISC License.
