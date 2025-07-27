
# Tax Filing Backend API

A comprehensive Node.js/Express backend for a tax filing application with PostgreSQL database, NextAuth authentication, document OCR processing, and AI-powered tax optimization.

## 🚀 Features

- **Authentication**: NextAuth.js compatible JWT authentication
- **Database**: PostgreSQL with Prisma ORM
- **Document Processing**: Google Document AI integration with LLM fallback
- **Tax Calculations**: Real-time tax liability calculations
- **AI Integration**: Tax optimization strategies using AbacusAI
- **File Upload**: Secure document upload with validation
- **API Documentation**: RESTful API with comprehensive endpoints
- **Security**: Helmet, CORS, rate limiting, input validation
- **Logging**: Winston logging with different levels
- **Docker**: Full containerization support

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- npm or yarn
- Docker (optional)

## 🛠️ Installation

### Local Development

1. **Clone and setup**
   ```bash
   cd /home/ubuntu/tax_filing_backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Start PostgreSQL (or use Docker)
   docker-compose up postgres -d
   
   # Run migrations
   npm run db:migrate
   
   # Generate Prisma client
   npm run db:generate
   
   # Seed database (optional)
   npm run db:seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

### Docker Deployment

1. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

2. **Run Database Migrations**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `NEXTAUTH_SECRET` | NextAuth secret key | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `PORT` | Server port | No | 8000 |
| `NODE_ENV` | Environment mode | No | development |
| `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud project ID | No | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | No | - |
| `ABACUSAI_API_KEY` | AbacusAI API key | No | - |
| `MAX_FILE_SIZE` | Maximum upload file size | No | 10485760 |

### Google Document AI Setup (Optional)

1. Create a Google Cloud project
2. Enable Document AI API
3. Create processors for W-2 and 1099 forms
4. Download service account credentials
5. Set environment variables

### AbacusAI Setup (Optional)

1. Sign up for AbacusAI account
2. Get API key from dashboard
3. Set `ABACUSAI_API_KEY` environment variable

## 📚 API Documentation

### Authentication Endpoints

#### POST `/api/auth/signup`
Register a new user.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### POST `/api/auth/signin`
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Tax Return Endpoints

#### GET `/api/tax-returns`
Get all tax returns for authenticated user.

#### POST `/api/tax-returns`
Create a new tax return.

**Request Body:**
```json
{
  "taxYear": 2023,
  "filingStatus": "SINGLE"
}
```

#### GET `/api/tax-returns/:id`
Get specific tax return with all related data.

#### PUT `/api/tax-returns/:id`
Update tax return data.

#### POST `/api/tax-returns/:id/auto-save`
Auto-save tax return data.

#### POST `/api/tax-returns/:id/complete-step`
Mark step as completed and advance workflow.

### Income/Deduction Endpoints

#### POST `/api/tax-returns/:id/income`
Add income entry to tax return.

#### PUT `/api/tax-returns/:id/income/:entryId`
Update income entry.

#### DELETE `/api/tax-returns/:id/income/:entryId`
Delete income entry.

#### POST `/api/tax-returns/:id/deductions`
Add deduction entry to tax return.

#### PUT `/api/tax-returns/:id/deductions/:entryId`
Update deduction entry.

#### DELETE `/api/tax-returns/:id/deductions/:entryId`
Delete deduction entry.

### Document Endpoints

#### POST `/api/documents/upload`
Upload tax document.

**Request:** Multipart form data with file and taxReturnId

#### POST `/api/documents/:id/process`
Process document with OCR (Server-Sent Events response).

#### GET `/api/tax-returns/:id/documents`
Get all documents for tax return.

#### DELETE `/api/documents/:id`
Delete document.

### AI Endpoints

#### POST `/api/ai/tax-strategies`
Get AI-powered tax optimization strategies.

#### POST `/api/ai/optimize`
Get tax optimization recommendations for scenario.

## 🗄️ Database Schema

The application uses PostgreSQL with the following main entities:

- **User**: User accounts with NextAuth compatibility
- **TaxReturn**: Main tax return entity with workflow management
- **IncomeEntry**: Income entries (W-2, 1099, etc.)
- **DeductionEntry**: Deduction entries (itemized deductions)
- **Dependent**: Dependent information
- **Document**: Uploaded documents with OCR processing
- **Account/Session**: NextAuth session management

## 🔒 Security Features

- **Authentication**: JWT-based authentication with NextAuth compatibility
- **Authorization**: Route-level authentication middleware
- **Input Validation**: Express-validator for request validation
- **File Upload Security**: File type and size validation
- **Rate Limiting**: Express-rate-limit for API protection
- **CORS**: Configurable CORS policy
- **Helmet**: Security headers
- **Password Hashing**: bcrypt with salt rounds

## 📊 Logging and Monitoring

- **Winston Logging**: Structured logging with different levels
- **Health Check**: `/health` endpoint for monitoring
- **Error Handling**: Centralized error handling middleware
- **Request Logging**: Morgan HTTP request logging

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```bash
   export NODE_ENV=production
   export DATABASE_URL="your_production_db_url"
   # ... other variables
   ```

3. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

4. **Start the server**
   ```bash
   npm start
   ```

### Docker Production

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.yml up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

## 🔧 Development

### Project Structure

```
src/
├── controllers/          # Route controllers (future)
├── middleware/          # Express middleware
│   ├── auth.ts         # Authentication middleware
│   └── errorHandler.ts # Error handling
├── routes/             # API routes
│   ├── auth.ts        # Authentication routes
│   ├── taxReturns.ts  # Tax return routes
│   ├── documents.ts   # Document routes
│   ├── ai.ts          # AI integration routes
│   └── debug.ts       # Debug routes
├── services/          # Business logic services
│   ├── taxCalculationService.ts
│   ├── documentProcessingService.ts
│   └── aiOptimizationService.ts
├── utils/             # Utility functions
│   ├── database.ts    # Prisma client
│   └── logger.ts      # Winston logger
└── server.ts          # Express app setup
```

### Adding New Features

1. **Database Changes**: Update `prisma/schema.prisma` and run migrations
2. **API Routes**: Add routes in appropriate route files
3. **Business Logic**: Implement in service files
4. **Validation**: Add input validation using express-validator
5. **Tests**: Add tests for new functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:

1. Check the API documentation above
2. Review the logs in `logs/` directory
3. Use the debug endpoints in development
4. Check database connectivity and migrations

## 🔄 Version History

- **v1.0.0**: Initial release with core functionality
  - Authentication system
  - Tax return management
  - Document processing
  - AI integration
  - Production-ready deployment
