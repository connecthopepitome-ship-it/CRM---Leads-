/** HTML → A4 PDF with headless Chromium (ADR-009). "Page x of y" via the footer template (FR-067 AC1). */
export async function renderPdf(html: string): Promise<Buffer> {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:8px;width:100%;text-align:right;padding-right:12mm;color:#64748b">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: '14mm', bottom: '18mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
