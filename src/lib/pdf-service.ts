import pdf from 'pdf-parse';

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    const data = await pdf(buffer);

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

export function validatePDFFile(file: File | Buffer, maxSizeMB = 10): { valid: boolean; error?: string } {
  const size = file instanceof File ? file.size : file.length;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `PDF file size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
}
