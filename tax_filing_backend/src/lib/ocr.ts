
import fs from 'fs'
import path from 'path'
import { DocumentType } from '@prisma/client'

interface OCRResult {
  text: string
  extractedData: any
  confidence?: number
}

class OCRService {
  private abacusApiKey: string | null = null

  constructor() {
    this.abacusApiKey = process.env.ABACUSAI_API_KEY || null
  }

  async processDocument(filePath: string, documentType: DocumentType): Promise<OCRResult> {
    try {
      // For now, return mock data since we don't have OCR configured
      return await this.processMockDocument(filePath, documentType)
    } catch (error) {
      console.error('OCR processing failed:', error)
      throw new Error('Document processing failed')
    }
  }

  private async processMockDocument(filePath: string, documentType: DocumentType): Promise<OCRResult> {
    // Return mock extracted data based on document type
    const mockData = this.getMockDataForDocumentType(documentType)
    
    return {
      text: `Mock OCR text for ${documentType} document`,
      extractedData: mockData,
      confidence: 0.85
    }
  }

  private getMockDataForDocumentType(documentType: DocumentType): any {
    switch (documentType) {
      case DocumentType.W2:
        return {
          employeeName: 'John Doe',
          employeeSSN: '123-45-6789',
          employerName: 'Sample Corporation',
          employerEIN: '12-3456789',
          wages: 50000,
          federalTaxWithheld: 7500
        }
      case DocumentType.FORM_1099_INT:
        return {
          payerName: 'Sample Bank',
          payerTIN: '98-7654321',
          recipientName: 'John Doe',
          recipientTIN: '123-45-6789',
          interestIncome: 150
        }
      default:
        return {
          amount: 1000,
          description: 'Sample extracted data'
        }
    }
  }

}

export const ocrService = new OCRService()
