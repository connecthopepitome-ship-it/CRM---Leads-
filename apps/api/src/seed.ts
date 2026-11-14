import type { Ctx } from './context.js';
import { ensureAdmin } from './modules/identity.js';
import { seedMasters } from './modules/masters.js';
import { created, nowIso } from './shared/core.js';

/** Provision a fresh install (FR-002): first admin, masters, company placeholder, web form. */
export async function seedInstall(ctx: Ctx, opts: { adminUsername: string; adminName: string; adminPassword: string; webCatalogue: boolean; company?: Record<string, unknown> }) {
  const adminId = await ensureAdmin(ctx, opts.adminUsername, opts.adminName, opts.adminPassword);
  await seedMasters(ctx, opts.webCatalogue);
  await ctx.db.tx(async (t) => {
    if (!(await t.get('settings_company', 'company'))) {
      t.set('settings_company', 'company', opts.company ?? { legalName: 'Acme Interiors', tradeName: 'Acme Interiors', gstRegistered: true, gstin: '29ABCDE1234F1Z5', stateCode: '29', address: '12 MG Road, Bengaluru 560001', phone: '+919800000000', email: 'hello@acme.example', jurisdiction: 'Bengaluru', signatory: 'Proprietor', version: 1 });
    }
    if (!(await t.get('webForms', 'default'))) t.set('webForms', 'default', { sourceId: 'm_leadSources_web_form', allowedOrigins: [], consentRequired: true, consentText: 'I agree to be contacted about my enquiry.', active: true, spamCount: 0, ...created(ctx, null) });
    if (!(await t.get('platform', 'release'))) t.set('platform', 'release', { version: '0.1.0', at: nowIso(ctx) });
    if (!(await t.get('migrations', '001-initial'))) t.set('migrations', '001-initial', { appliedAt: nowIso(ctx) });
  });
  return adminId;
}
