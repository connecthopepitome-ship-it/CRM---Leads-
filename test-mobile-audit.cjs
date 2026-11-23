const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { width: 320, height: 640, name: '320px (iPhone SE 1st gen)' },
  { width: 360, height: 740, name: '360px (Galaxy S8 / standard)' },
  { width: 375, height: 667, name: '375px (iPhone SE / 8)' },
  { width: 390, height: 844, name: '390px (iPhone 12 / 13 / 14)' },
  { width: 414, height: 896, name: '414px (iPhone XR / 11)' },
  { width: 430, height: 932, name: '430px (iPhone 14/15 Pro Max)' },
];

const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/leads', name: 'Leads List' },
  { path: '/leads/new', name: 'New Lead' },
  { path: '/leads/lead-1', name: 'Lead Detail' },
  { path: '/customers', name: 'Customers Directory' },
  { path: '/customers/cust-1', name: 'Customer 360' },
  { path: '/sales?tab=quotes', name: 'Quotations List' },
  { path: '/sales/quotes/new', name: 'New Quotation Builder' },
  { path: '/sales/quotes/qt-1', name: 'Quotation Detail' },
  { path: '/sales?tab=invoices', name: 'Invoices List' },
  { path: '/sales/invoices/inv-1', name: 'Invoice Detail' },
  { path: '/sales?tab=payments', name: 'Payments List' },
  { path: '/sales/payments/pay-1', name: 'Payment Detail' },
  { path: '/sales/payments/new', name: 'Record Payment' },
  { path: '/settings', name: 'Settings' },
];

const BASE_URL = 'https://crm---leads.connect-hopepitome.workers.dev';
const SCREENSHOT_DIR = path.join(__dirname, 'mobile-audit-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runAudit() {
  console.log(`Starting SaleSphere Mobile Responsive Audit on ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });

  const summary = [];
  let totalErrors = 0;

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    });

    const page = await context.newPage();

    // Authenticate by setting demo session in localStorage
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('ss-signed-out');
      localStorage.setItem('ss-demo-active', 'true');
    });

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(600);

      // Check overflow
      const overflowMetrics = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const winInnerWidth = window.innerWidth;
        const bodyScrollWidth = document.body.scrollWidth;

        // Find overflowing elements
        const overflowingElements = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > winInnerWidth + 1) {
            overflowingElements.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 60),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }

        return {
          docScrollWidth,
          bodyScrollWidth,
          winInnerWidth,
          hasOverflow: docScrollWidth > winInnerWidth,
          overflowingElements: overflowingElements.slice(0, 5),
        };
      });

      const passed = !overflowMetrics.hasOverflow;
      if (!passed) totalErrors++;

      console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: ${route.name} (${route.path}) - Doc: ${overflowMetrics.docScrollWidth}px / Win: ${overflowMetrics.winInnerWidth}px`);
      if (!passed) {
        console.log(`    -> Overflowing elements:`, JSON.stringify(overflowMetrics.overflowingElements));
      }

      // Take screenshot for key screens at 375px
      if (vp.width === 375 && ['Dashboard', 'Invoice Detail', 'Quotations List', 'New Quotation Builder', 'Leads List'].includes(route.name)) {
        const ssPath = path.join(SCREENSHOT_DIR, `${route.name.replace(/\s+/g, '_')}_${vp.width}px.png`);
        await page.screenshot({ path: ssPath, fullPage: false });
        console.log(`    [Screenshot saved: ${path.basename(ssPath)}]`);
      }

      summary.push({
        viewport: vp.width,
        route: route.name,
        path: route.path,
        docWidth: overflowMetrics.docScrollWidth,
        winWidth: overflowMetrics.winInnerWidth,
        passed,
      });
    }

    await context.close();
  }

  await browser.close();

  console.log(`\n======================================================`);
  console.log(`AUDIT COMPLETE: ${totalErrors === 0 ? 'ALL VIEWPORTS & ROUTES PASSED ZERO OVERFLOW!' : `${totalErrors} FAILURES FOUND`}`);
  console.log(`======================================================`);
}

runAudit().catch(console.error);
