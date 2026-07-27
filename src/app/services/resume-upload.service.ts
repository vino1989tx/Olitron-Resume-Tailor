import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

@Injectable({
  providedIn: 'root',
})
export class ResumeUploadService {
  private workerConfigured = false;

  constructor() {
    // Prefer the PDF.js worker bundled with the app (copied into the build output
    // by the angular.json "assets" rule). v4 ships an ESM worker
    // (pdf.worker.min.mjs); the old CDN "pdf.worker.min.js" 404'd. Resolving
    // against document.baseURI respects the app's base href.
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdf.worker.min.mjs',
      document.baseURI,
    ).toString();
  }

  /**
   * Make sure the PDF.js worker URL actually loads. If the bundled worker is not
   * being served (e.g. the dev server was not restarted after it was added, which
   * makes extraction hang forever), fall back to the matching CDN worker so
   * uploads keep working.
   */
  private async ensureWorkerReachable(): Promise<void> {
    if (this.workerConfigured) return;
    const localSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
    let reachable = false;
    try {
      const res = await fetch(localSrc, { headers: { Range: 'bytes=0-0' } });
      reachable = res.ok || res.status === 206;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }
    this.workerConfigured = true;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }

  /**
   * Extract text from a PDF file
   */
  async extractTextFromPdf(file: File): Promise<string> {
    await this.ensureWorkerReachable();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await this.withTimeout(
      pdfjsLib.getDocument({ data: arrayBuffer }).promise,
      45000,
      'Reading the PDF timed out. Please re-upload, or if you are running the dev server, stop and restart it (npm start) so the PDF engine loads.',
    );

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  /**
   * Extract text from a DOCX file
   * Note: This is a simplified extraction. For production, consider using libraries like mammoth.js
   */
  async extractTextFromDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use JSZip to read the DOCX structure
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    await zip.loadAsync(arrayBuffer);

    // Read document.xml which contains the text
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      throw new Error('Invalid DOCX file: document.xml not found');
    }

    const docContent = await docFile.async('text');

    // Simple regex extraction - removes XML tags and extracts text
    // This is basic; for production use a proper XML parser or library like mammoth.js
    const textContent = docContent
      .replace(/<[^>]+>/g, ' ') // Remove XML tags
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return textContent;
  }

  /**
   * Extract text from either PDF or DOCX based on file type
   */
  async extractResumeText(file: File): Promise<string> {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return this.extractTextFromPdf(file);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      return this.extractTextFromDocx(file);
    }

    throw new Error(
      `Unsupported file format: ${file.type}. Please upload a PDF or DOCX file.`
    );
  }

  /**
   * Validate file before processing
   */
  validateFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Please upload a smaller file.`,
      };
    }

    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const isPdf = mimeType === 'application/pdf' || fileName.endsWith('.pdf');
    const isDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx');

    if (!isPdf && !isDocx) {
      return {
        valid: false,
        error: 'Only PDF and DOCX files are supported.',
      };
    }

    return { valid: true };
  }
}
