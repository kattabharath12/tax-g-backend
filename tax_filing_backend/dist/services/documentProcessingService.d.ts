import { Document } from '@prisma/client';
export interface ProcessingProgress {
    step: string;
    progress: number;
    message: string;
}
export interface ProcessingResult {
    ocrText: string;
    extractedData: any;
}
export declare function processDocument(document: Document, onProgress?: (progress: ProcessingProgress) => void): Promise<ProcessingResult>;
//# sourceMappingURL=documentProcessingService.d.ts.map