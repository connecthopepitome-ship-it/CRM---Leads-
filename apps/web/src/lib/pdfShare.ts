/**
 * HopEpitome Document PDF Generation & Direct WhatsApp PDF Sharing
 * Converts server-rendered HopEpitome HTML templates into real A4 PDF files
 * and shares them as native document attachments via WhatsApp / Web Share API.
 */
import html2pdf from 'html2pdf.js';
import { toast } from '../ui/toast';

export interface DocShareOptions {
  type: 'quote' | 'order' | 'invoice';
  id: string;
  docNumber: string;
  partyName?: string | null;
  partyPhone?: string | null;
  balanceDueText?: string | null;
}

const TYPE_NAMES: Record<DocShareOptions['type'], string> = {
  quote: 'Quotation',
  order: 'Sales Order',
  invoice: 'Tax Invoice',
};

/**
 * Converts HopEpitome HTML into a high-resolution A4 PDF Blob
 */
export async function generatePdfBlobFromHtml(html: string): Promise<Blob> {
  const container = document.createElement('div');
  container.id = 'hop-pdf-staging';
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: 0,
      filename: 'document.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    const blob: Blob = await (html2pdf() as any).from(container).set(opt).output('blob');
    return blob;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Downloads the real PDF document directly to the user's device
 */
export async function downloadDocPdf(type: DocShareOptions['type'], id: string, docNumber: string) {
  const typeLabel = TYPE_NAMES[type] || 'Document';
  const cleanNumber = (docNumber || 'Draft').replace(/[\/\\]/g, '-');
  const fileName = `${typeLabel}_${cleanNumber}.pdf`;

  try {
    toast(`Generating ${typeLabel} PDF...`, 'info');
    const res = await fetch(`/api/v1/documents/${type}/${id}/html`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const html = await res.text();
    const blob = await generatePdfBlobFromHtml(html);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast(`${typeLabel} PDF downloaded successfully`, 'success');
  } catch (err: any) {
    console.error('PDF generation failed:', err);
    // Fallback to printable browser window
    window.open(`/api/v1/documents/${type}/${id}/pdf`, '_blank', 'noopener');
  }
}

/**
 * Shares the real PDF document file directly via WhatsApp (NOT a web link)
 */
export async function sharePdfViaWhatsApp({
  type,
  id,
  docNumber,
  partyName,
  partyPhone,
  balanceDueText,
}: DocShareOptions) {
  const typeLabel = TYPE_NAMES[type] || 'Document';
  const cleanNumber = (docNumber || 'Draft').replace(/[\/\\]/g, '-');
  const fileName = `${typeLabel}_${cleanNumber}.pdf`;

  try {
    toast(`Preparing ${typeLabel} PDF for WhatsApp...`, 'info');

    // 1. Fetch official HopEpitome document HTML
    const res = await fetch(`/api/v1/documents/${type}/${id}/html`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const html = await res.text();

    // 2. Generate real A4 PDF Blob & File object
    const blob = await generatePdfBlobFromHtml(html);
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

    // 3. Message text for WhatsApp (NO web link included)
    const greeting = partyName ? `Dear ${partyName},` : 'Hello,';
    const balanceNotice = balanceDueText ? `\nBalance Due: ₹${balanceDueText}` : '';
    const messageText = `${greeting}\n\nPlease find attached official ${typeLabel} *${docNumber}* from *HopEpitome Strategics*.${balanceNotice}\n\nThank you for choosing HopEpitome Strategics.`;

    // 4. Mobile / Web Share API with native file attachment
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `${typeLabel} ${docNumber}`,
          text: messageText,
        });
        toast(`${typeLabel} PDF sent to WhatsApp`, 'success');
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return; // User closed share sheet
        console.warn('Native share failed, using WhatsApp Web fallback:', shareErr);
      }
    }

    // 5. Desktop / WhatsApp Web Fallback:
    // Download the PDF immediately so the user has the file in their hands
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(fileUrl);

    // Open WhatsApp chat directly with clean message (no link)
    const cleanPhone = (partyPhone || '').replace(/\D/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    window.open(waUrl, '_blank', 'noopener');
    toast(`PDF downloaded! Attach "${fileName}" into the WhatsApp chat.`, 'info');
  } catch (err: any) {
    console.error('WhatsApp PDF share failed:', err);
    toast('Failed to share PDF. Opening print preview...', 'error');
    window.open(`/api/v1/documents/${type}/${id}/pdf`, '_blank', 'noopener');
  }
}
