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
    name: cfg.appName === 'SaleSphere' ? `SaleSphere — ${cfg.companyName}` : cfg.appName,
    short_name: cfg.appName,
    start_url: '/',
    display: 'standalone' as const,
    background_color: '#F8FAFC',
    theme_color: cfg.branding.primary,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  };
}

/** Local development default (no CLIENT_ID). */
export const DEV_CLIENT: ClientConfig = ClientConfig.parse({ clientId: 'dev', companyName: 'Development', domain: 'localhost', firebaseProjectId: 'salesphere-dev' });
