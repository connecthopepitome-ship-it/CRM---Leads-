import { z } from 'zod';

/** Per-client install configuration (RULE-001, FR-001). Validated before any build or deploy. */
export const ClientConfig = z.object({
  clientId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  companyName: z.string().min(2).max(120),
  appName: z.string().min(2).max(40).default('SaleSphere'),
  domain: z.string().min(4),
  firebaseProjectId: z.string().min(4),
  region: z.literal('asia-south1').default('asia-south1'),
  mode: z.enum(['solo', 'team']).default('solo'),
  modules: z.object({ orders: z.boolean().default(false), sheetSync: z.boolean().default(true), webForm: z.boolean().default(true) }).default({}),
  branding: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563EB'),
    primaryDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#60A5FA'),
    logoLight: z.string().optional(),
    logoDark: z.string().optional(),
    poweredBy: z.boolean().default(true),
  }).default({}),
  terminology: z.record(z.string()).default({}),
  seedCatalogue: z.enum(['none', 'web-services']).default('none'),
  adminUsername: z.string().regex(/^[a-z0-9._-]{3,32}$/).default('admin'),
});
export type ClientConfig = z.infer<typeof ClientConfig>;

export function parseClientConfig(raw: unknown): ClientConfig {
  return ClientConfig.parse(raw);
}

/** FR-001 AC2: validate before build/provisioning; the error names every bad key so nothing is deployed. */
export function loadClientConfig(raw: unknown, source = 'config.json'): ClientConfig {
  const r = ClientConfig.safeParse(raw);
  if (r.success) return r.data;
  const lines = r.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error([`Invalid client config ${source}:`, ...lines].join('\n'));
}

/** FR-001 AC1/AC3: the PWA manifest is derived only from this client's config. */
export function manifestFor(cfg: ClientConfig) {
  return {
    name: cfg.appName === 'SaleSphere' ? `SaleSphere CRM` : cfg.appName,
    short_name: cfg.appName,
    description: 'SaleSphere Enterprise CRM — Offline-ready Mobile Sales, Pipeline & GST Billing',
    start_url: '/',
    scope: '/',
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    background_color: '#0c1024',
    theme_color: '#0c1024',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: '192x192 512x512 any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
    shortcuts: [
      {
        name: 'New Lead',
        short_name: 'New Lead',
        url: '/leads/new',
        icons: [{ src: '/icon.svg', sizes: '192x192' }],
      },
      {
        name: 'New Quotation',
        short_name: 'New Quote',
        url: '/sales/quotes/new',
        icons: [{ src: '/icon.svg', sizes: '192x192' }],
      },
      {
        name: 'Record Payment',
        short_name: 'Payment',
        url: '/sales/payments/new',
        icons: [{ src: '/icon.svg', sizes: '192x192' }],
      },
      {
        name: 'My Tasks',
        short_name: 'Tasks',
        url: '/follow-ups',
        icons: [{ src: '/icon.svg', sizes: '192x192' }],
      },
    ],
  };
}

/** Local development default (no CLIENT_ID). */
export const DEV_CLIENT: ClientConfig = ClientConfig.parse({ clientId: 'dev', companyName: 'Development', domain: 'localhost', firebaseProjectId: 'salesphere-dev' });
