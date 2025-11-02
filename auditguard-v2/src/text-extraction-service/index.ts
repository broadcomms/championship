/**
 * Text Extraction Service
 * Extracts and cleans text from various document formats (PDF, DOCX, MD, TXT)
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import mammoth from 'mammoth';

export interface ExtractedText {
  text: string;
  pageCount?: number;
  wordCount: number;
  metadata?: {
    extractedFrom: string;
    originalSize: number;
    cleanedSize: number;
  };
}

export class TextExtractionService {
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Extract clean text from various document formats
   * Supports: PDF, DOCX, Markdown, Plain Text
   */
  async extractText(
    file: Buffer,
    contentType: string,
    filename: string
  ): Promise<ExtractedText> {
    this.env.logger?.info('Starting text extraction', {
      contentType,
      filename,
      fileSize: file.length,
    });

    let extractedText = '';
    let pageCount: number | undefined;
    const originalSize = file.length;

    try {
      // PDF Extraction
      if (contentType === 'application/pdf' || filename.endsWith('.pdf')) {
        this.env.logger?.info('Extracting text from PDF', { filename });
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(file),
          useSystemFonts: true,
          standardFontDataUrl: undefined, // Don't load external fonts (not available in Workers)
        });
        
        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages;
        
        // Extract text from all pages
        const textPages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          textPages.push(pageText);
        }
        
        extractedText = textPages.join('\n\n');
        
        this.env.logger?.info('PDF text extracted', {
          filename,
          pages: pageCount,
          textLength: extractedText.length,
        });
      }
      // DOCX Extraction
      else if (
        contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.endsWith('.docx')
      ) {
        this.env.logger?.info('Extracting text from DOCX', { filename });
        const result = await mammoth.extractRawText({ buffer: file });
        extractedText = result.value;
        
        this.env.logger?.info('DOCX text extracted', {
          filename,
          textLength: extractedText.length,
        });
      }
      // Plain Text / Markdown (both need cleaning!)
      else if (
        contentType.startsWith('text/') ||
        filename.match(/\.(txt|md|markdown)$/i)
      ) {
        this.env.logger?.info('Extracting text from text file', {
          filename,
          contentType,
        });
        extractedText = file.toString('utf-8');
        
        this.env.logger?.info('Text file extracted', {
          filename,
          textLength: extractedText.length,
        });
      }
      // Unsupported format
      else {
        throw new Error(`Unsupported file type: ${contentType} (${filename})`);
      }

      // Clean the extracted text (IMPORTANT: Even for MD and TXT!)
      const cleanedText = this.cleanText(extractedText);
      const wordCount = this.countWords(cleanedText);

      this.env.logger?.info('Text extraction and cleaning completed', {
        filename,
        originalLength: extractedText.length,
        cleanedLength: cleanedText.length,
        wordCount,
        pageCount,
        reductionPercent: ((1 - cleanedText.length / extractedText.length) * 100).toFixed(1),
      });

      return {
        text: cleanedText,
        pageCount,
        wordCount,
        metadata: {
          extractedFrom: contentType,
          originalSize,
          cleanedSize: Buffer.from(cleanedText).length,
        },
      };
    } catch (error) {
      this.env.logger?.error('Text extraction failed', {
        filename,
        contentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean extracted text for optimal AI processing
   * 
   * Cleaning steps:
   * - Normalize line breaks
   * - Remove page numbers
   * - Remove excessive whitespace
   * - Remove headers/footers patterns
   * - Trim each line
   * - Normalize encoding
   */
  private cleanText(text: string): string {
    return (
      text
        // Normalize all line breaks to \n
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        
        // Remove common page number patterns
        .replace(/Page \d+ of \d+/gi, '')
        .replace(/\nPage \d+\n/gi, '\n')
        .replace(/\n\d+\n/g, '\n') // Standalone numbers on lines
        
        // Remove Markdown formatting characters (convert to clean text)
        .replace(/#{1,6}\s/g, '') // Headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
        .replace(/\*([^*]+)\*/g, '$1') // Italic
        .replace(/`([^`]+)`/g, '$1') // Inline code
        .replace(/```[\s\S]*?```/g, '') // Code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/^\s*[-*+]\s+/gm, '') // List markers
        .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
        
        // Remove table separators
        .replace(/\|/g, ' ')
        .replace(/[-]{3,}/g, '')
        
        // Remove excessive whitespace
        .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
        .replace(/\n{3,}/g, '\n\n') // Multiple newlines to max 2
        
        // Trim each line
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0) // Remove empty lines
        .join('\n')
        
        // Final trim
        .trim()
    );
  }

  /**
   * Count words in text (for metadata)
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Validate extracted text quality
   * Returns warnings if text seems problematic
   */
  validateExtraction(extracted: ExtractedText): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check if text is too short
    if (extracted.text.length < 100) {
      warnings.push('Extracted text is very short (<100 characters)');
    }

    // Check if text is too long (>1MB)
    if (extracted.text.length > 1_000_000) {
      warnings.push('Extracted text is very large (>1MB)');
    }

    // Check word count
    if (extracted.wordCount < 10) {
      warnings.push('Very few words extracted (<10 words)');
    }

    // Check for excessive special characters (might indicate extraction failure)
    const specialCharRatio =
      (extracted.text.match(/[^\w\s]/g) || []).length / extracted.text.length;
    if (specialCharRatio > 0.3) {
      warnings.push('High ratio of special characters (might indicate extraction issues)');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
}
