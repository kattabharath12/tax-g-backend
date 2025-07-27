
import { PrismaClient, FilingStatus, IncomeType, DeductionType, DocumentType, ProcessingStatus } from '@prisma/client'
import { hashPassword } from '../lib/auth'
import { Decimal } from 'decimal.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create test user
  const hashedPassword = await hashPassword('password123')
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      password: hashedPassword
    }
  })

  console.log('✅ Created test user:', user.email)

  // Create sample tax return
  const taxReturn = await prisma.taxReturn.upsert({
    where: { id: 'sample-tax-return-id' },
    update: {},
    create: {
      id: 'sample-tax-return-id',
      userId: user.id,
      taxYear: 2023,
      filingStatus: FilingStatus.SINGLE,
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123-45-6789',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      currentStep: 3,
      completedSteps: [1, 2],
      totalIncome: new Decimal(75000),
      adjustedGrossIncome: new Decimal(75000),
      standardDeduction: new Decimal(13850),
      itemizedDeduction: new Decimal(8500),
      taxableIncome: new Decimal(61150),
      taxLiability: new Decimal(9200),
      totalCredits: new Decimal(0),
      refundAmount: new Decimal(1800),
      amountOwed: new Decimal(0)
    }
  })

  console.log('✅ Created sample tax return for year:', taxReturn.taxYear)

  // Create sample income entries
  const incomeEntries = [
    {
      taxReturnId: taxReturn.id,
      incomeType: IncomeType.W2_WAGES,
      description: 'Salary from ABC Corp',
      amount: new Decimal(65000),
      employerName: 'ABC Corporation',
      employerEIN: '12-3456789'
    },
    {
      taxReturnId: taxReturn.id,
      incomeType: IncomeType.INTEREST,
      description: 'Bank interest',
      amount: new Decimal(250),
      payerName: 'First National Bank',
      payerTIN: '98-7654321'
    },
    {
      taxReturnId: taxReturn.id,
      incomeType: IncomeType.DIVIDENDS,
      description: 'Stock dividends',
      amount: new Decimal(1200),
      payerName: 'Investment Brokerage',
      payerTIN: '11-2233445'
    }
  ]

  for (const entry of incomeEntries) {
    await prisma.incomeEntry.create({ data: entry })
  }

  console.log('✅ Created sample income entries')

  // Create sample deduction entries
  const deductionEntries = [
    {
      taxReturnId: taxReturn.id,
      deductionType: DeductionType.MORTGAGE_INTEREST,
      description: 'Home mortgage interest',
      amount: new Decimal(12000)
    },
    {
      taxReturnId: taxReturn.id,
      deductionType: DeductionType.STATE_LOCAL_TAXES,
      description: 'State and local taxes',
      amount: new Decimal(8500)
    },
    {
      taxReturnId: taxReturn.id,
      deductionType: DeductionType.CHARITABLE_CONTRIBUTIONS,
      description: 'Charitable donations',
      amount: new Decimal(2500)
    }
  ]

  for (const entry of deductionEntries) {
    await prisma.deductionEntry.create({ data: entry })
  }

  console.log('✅ Created sample deduction entries')

  // Create sample dependents
  const dependents = [
    {
      taxReturnId: taxReturn.id,
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987-65-4321',
      relationship: 'Child',
      birthDate: new Date('2015-06-15')
    },
    {
      taxReturnId: taxReturn.id,
      firstName: 'Bob',
      lastName: 'Doe',
      ssn: '456-78-9012',
      relationship: 'Child',
      birthDate: new Date('2018-03-22')
    }
  ]

  for (const dependent of dependents) {
    await prisma.dependent.create({ data: dependent })
  }

  console.log('✅ Created sample dependents')

  // Create sample documents
  const documents = [
    {
      taxReturnId: taxReturn.id,
      fileName: 'w2-2023-abc-corp.pdf',
      fileType: 'application/pdf',
      fileSize: 245760,
      filePath: '/uploads/documents/sample-w2.pdf',
      documentType: DocumentType.W2,
      processingStatus: ProcessingStatus.COMPLETED,
      ocrText: 'W-2 Wage and Tax Statement for John Doe...',
      extractedData: {
        employeeName: 'John Doe',
        employeeSSN: '123-45-6789',
        employerName: 'ABC Corporation',
        employerEIN: '12-3456789',
        wages: 65000,
        federalTaxWithheld: 9800,
        socialSecurityWages: 65000,
        socialSecurityTaxWithheld: 4030
      },
      isVerified: true,
      verifiedBy: user.id
    },
    {
      taxReturnId: taxReturn.id,
      fileName: '1099-int-2023-bank.pdf',
      fileType: 'application/pdf',
      fileSize: 156432,
      filePath: '/uploads/documents/sample-1099-int.pdf',
      documentType: DocumentType.FORM_1099_INT,
      processingStatus: ProcessingStatus.COMPLETED,
      ocrText: '1099-INT Interest Income for John Doe...',
      extractedData: {
        payerName: 'First National Bank',
        payerTIN: '98-7654321',
        recipientName: 'John Doe',
        recipientTIN: '123-45-6789',
        interestIncome: 250
      },
      isVerified: true,
      verifiedBy: user.id
    }
  ]

  for (const document of documents) {
    await prisma.document.create({ data: document })
  }

  console.log('✅ Created sample documents')

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
