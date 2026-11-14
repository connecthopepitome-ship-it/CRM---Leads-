import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const NEW_PW = 'E2e-Strong-Pass-2026';

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).exclude('iframe.doc-frame').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label}: ${v.id} — ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(NEW_PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // first run on a fresh server: temporary password → forced change (FR-009)
  const home = page.getByRole('heading', { level: 1, name: /Good/ });
  const wrong = page.getByText('Username or password is incorrect.');
  await expect(home.or(wrong)).toBeVisible();
  if (await wrong.isVisible()) {
    await page.getByLabel('Password', { exact: true }).fill('Temp-Passw0rd-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByLabel('Current password').fill('Temp-Passw0rd-1');
    await page.getByLabel('New password', { exact: true }).fill(NEW_PW);
    await page.getByLabel('Confirm new password').fill(NEW_PW);
    await page.getByRole('button', { name: 'Save password' }).click();
  }
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good');
}

test('J-01/J-03/J-04/J-05 sign in → lead → quote → customer accepts → invoice with UPI → payment → PAID', async ({ page, context, browserName }, info) => {
  test.setTimeout(240_000);
  test.skip(info.project.name !== 'desktop-chromium', 'full journey runs once; mobile runs the a11y + shell checks');
  await signIn(page);
  await axe(page, 'home');

  // finance master: a default UPI ID so invoices show a QR (FR-068); test-only VPA
  await page.goto('/settings/masters?type=upiIds');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name', { exact: true }).fill('E2E UPI');
  await dlg.getByLabel('UPI ID (VPA)').fill('e2e.test@okaxis');
  await dlg.getByLabel('Payee name', { exact: true }).fill('E2E Test');
  await dlg.getByLabel('Default (used on new invoices)').check();
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'e2e.test@okaxis' }).first()).toBeVisible();

  // lead (FR-025)
  const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  await page.goto('/leads/new');
  await page.getByLabel('Name').fill('Ravi Kumar');
  await page.getByLabel('Mobile').fill(phone);
  await page.getByRole('button', { name: 'Create lead' }).click();
  await expect(page.getByRole('heading', { name: 'Ravi Kumar' })).toBeVisible();
  await axe(page, 'lead detail');

  // note (FR-048)
  await page.getByRole('button', { name: 'Note' }).click();
  await page.getByRole('dialog').getByLabel('Note').fill('Wants a 5-page website');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Wants a 5-page website')).toBeVisible();

  // quote (FR-051, FR-052) from the lead
  await page.getByRole('link', { name: 'New quote' }).click();
  await page.getByLabel('Catalogue item').selectOption({ label: 'Website – Basic (5 pages)' });
  await expect(page.getByText('₹29,500.00').first()).toBeVisible(); // 25,000 + 18 % GST
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('heading', { name: 'Draft quotation' })).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Send & copy link' }).click();
  await expect(page.getByRole('heading', { name: /^QT\// })).toBeVisible();
  await axe(page, 'quote detail');
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(shareUrl).toContain('/s/');

  // customer accepts on the public page (FR-057)
  const customerCtx = await context.browser()!.newContext({ baseURL: 'http://localhost:4173' });
  const customer = await customerCtx.newPage();
  await customer.goto(new URL(shareUrl).pathname);
  await expect(customer.getByRole('button', { name: 'Accept' })).toBeVisible();
  await axe(customer, 'public quote');
  await customer.getByRole('button', { name: 'Accept' }).click();
  await customer.getByLabel('Type your full name to accept').fill('Ravi Kumar');
  await customer.getByRole('button', { name: 'Accept quotation' }).click();
  await expect(customer.getByText('your acceptance has been recorded')).toBeVisible();
  await customerCtx.close();

  // invoice via silent order, issue (FR-059 AC4, FR-065)
  await page.reload();
  await expect(page.getByText(/Customer accepted/)).toBeVisible();
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByRole('heading', { name: /^INV\// })).toBeVisible();
  await expect(page.getByRole('img', { name: /UPI QR code for ₹29,500.00/ })).toBeVisible();
  await axe(page, 'invoice detail');

  // part payment lowers the QR (FR-068 AC2), then full payment → PAID (AC3)
  await page.getByRole('link', { name: 'Record payment' }).click();
  await page.getByLabel('Amount received (₹)').fill('9500');
  await page.getByLabel('UTR / reference').fill(`UTR${Date.now()}`);
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(page.getByRole('heading', { name: /Receipt RCPT\// })).toBeVisible();
  await page.getByRole('link', { name: /^INV\// }).click();
  await expect(page.getByRole('img', { name: /UPI QR code for ₹20,000.00/ })).toBeVisible();
  await page.getByRole('link', { name: 'Record payment' }).click();
  await page.getByLabel('Amount received (₹)').fill('20000');
  await page.getByLabel('Mode').selectOption('cash');
  await page.getByRole('button', { name: 'Save payment' }).click();
  await page.getByRole('link', { name: /^INV\// }).click();
  await expect(page.getByText('PAID', { exact: true })).toBeVisible();
  void browserName;
});

test('NFR-013 shell, lists and settings have no serious accessibility violations (mobile + desktop)', async ({ page }) => {
  await signIn(page);
  for (const path of ['/', '/leads', '/customers', '/sales', '/follow-ups', '/reports', '/settings', '/settings/masters', '/settings/users', '/settings/import-data', '/settings/preferences', '/me']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await axe(page, path);
  }
});

test('FR-080 AC4 dark theme renders with tokens', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.removeItem('ss-theme'));
  await page.goto('/sign-in');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await axe(page, 'sign-in dark');
});
