/**
 * Client adapter for Google Apps Script Drive & PDF microservice.
 * Uploads images, files, and converts PDFs directly into Google Drive with zero GCP billing.
 */

export interface AppScriptUploadResult {
  status: 'ok';
  fileId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  viewUrl: string;
  downloadUrl: string;
}

export class AppScriptDriveClient {
  private url: string;
  private secret: string;

  constructor(opts?: { url?: string; secret?: string }) {
    this.url = opts?.url || process.env.GOOGLE_APPSCRIPT_URL || '';
    this.secret = opts?.secret || process.env.GOOGLE_APPSCRIPT_SECRET || 'SaleSphere_Drive_Secret_2026';
  }

  isConfigured(): boolean {
    return !!this.url && this.url.startsWith('https://script.google.com');
  }

  /**
   * Upload an image, attachment or binary file to Google Drive via Apps Script
   */
  async uploadFile(opts: {
    folderType: 'quotes' | 'invoices' | 'payments' | 'leads' | 'customers';
    fileName: string;
    mimeType: string;
    data: Buffer;
    makePublic?: boolean;
  }): Promise<AppScriptUploadResult> {
    if (!this.isConfigured()) {
      // Mock fallback for offline / development testing
      const mockId = `mock_drive_${Date.now().toString(36)}`;
      return {
        status: 'ok',
        fileId: mockId,
        fileName: opts.fileName,
        sizeBytes: opts.data.length,
        mimeType: opts.mimeType,
        viewUrl: `https://drive.google.com/file/d/${mockId}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${mockId}`,
      };
    }

    const payload = {
      action: 'uploadFile',
      secret: this.secret,
      folderType: opts.folderType,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      base64Data: opts.data.toString('base64'),
      makePublic: !!opts.makePublic,
    };

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Apps Script upload failed with status ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as AppScriptUploadResult;
    return json;
  }

  /**
   * Generates a PDF from HTML and saves directly to Google Drive
   */
  async generateAndSavePdf(opts: {
    folderType: 'quotes' | 'invoices';
    fileName: string;
    htmlContent: string;
    makePublic?: boolean;
  }): Promise<AppScriptUploadResult> {
    if (!this.isConfigured()) {
      const mockId = `mock_pdf_${Date.now().toString(36)}`;
      return {
        status: 'ok',
        fileId: mockId,
        fileName: opts.fileName,
        sizeBytes: opts.htmlContent.length,
        mimeType: 'application/pdf',
        viewUrl: `https://drive.google.com/file/d/${mockId}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${mockId}`,
      };
    }

    const payload = {
      action: 'generatePdf',
      secret: this.secret,
      folderType: opts.folderType,
      fileName: opts.fileName,
      htmlContent: opts.htmlContent,
      makePublic: !!opts.makePublic,
    };

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Apps Script PDF generation failed with status ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as AppScriptUploadResult;
    return json;
  }

  /**
   * Deletes a file in Google Drive
   */
  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.isConfigured()) return true;

    const payload = {
      action: 'deleteFile',
      secret: this.secret,
      fileId,
    };

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  }
}
