/** Environment configuration (documented in /.env.example). */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  appOrigin: string;
  apiBase: string;
  edgeSecret: string | null;
  jwtPrivateJwk: string | null;
  cookieSecure: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string | null;
  googlePickerKey: string | null;
  fcmVapidPublicKey: string | null;
  pdfFunctionUrl: string | null;
  emailDailyLimit: number;
  leadFormRatePerMin: number;
  leadFormMinFillMs: number;
  auditMaxRangeDays: number;
  fileMaxMb: number;
  junkRetentionMonths: number;
}

/** Secrets every production function except `pdf` must have (Secret Manager → functions `secrets:`). */
export const PRODUCTION_SECRETS = ['JWT_PRIVATE_JWK', 'EDGE_HMAC_SECRET', 'GOOGLE_CLIENT_SECRET', 'DATA_ENC_KEY'] as const;

/** Fail fast instead of silently using dev fallbacks (random JWT key, dev seal key, no edge check). */
export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env) {
  const missing = PRODUCTION_SECRETS.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing production secrets: ${missing.join(', ')} — see docs/10-ops/RUNBOOK.md §Secrets`);
}

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = (env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development') as AppConfig['env'];
  return {
    env: mode,
    appOrigin: env.APP_ORIGIN ?? 'http://localhost:5173',
    apiBase: env.API_BASE ?? '/api/v1',
    edgeSecret: env.EDGE_HMAC_SECRET ?? null,
    jwtPrivateJwk: env.JWT_PRIVATE_JWK ?? null,
    cookieSecure: mode === 'production',
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? null,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI ?? null,
    googlePickerKey: env.GOOGLE_PICKER_API_KEY ?? null,
    fcmVapidPublicKey: env.FCM_VAPID_PUBLIC_KEY ?? null,
    pdfFunctionUrl: env.PDF_FUNCTION_URL ?? null,
    emailDailyLimit: num(env.EMAIL_DAILY_LIMIT, 450),
    leadFormRatePerMin: num(env.LEAD_FORM_RATE_PER_MIN, 60),
    leadFormMinFillMs: num(env.LEAD_FORM_MIN_FILL_MS, 3000),
    auditMaxRangeDays: num(env.AUDIT_MAX_RANGE_DAYS, 366),
    fileMaxMb: num(env.FILE_MAX_MB, 25),
    junkRetentionMonths: num(env.JUNK_RETENTION_MONTHS, 3),
  };
}
