/** FR-001 client configuration (RULE-001). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadClientConfig, manifestFor } from '../src/index.js';

const example = JSON.parse(readFileSync(new URL('../../../clients/example/config.json', import.meta.url), 'utf8'));

describe('client config (FR-001)', () => {
  it('TC-001 FR-001 AC1 a valid config produces the client name, colours and PWA manifest', () => {
    const cfg = loadClientConfig({ ...example, companyName: 'Ravi Web Studio', branding: { primary: '#0F766E' } });
    expect(manifestFor(cfg)).toMatchObject({ name: 'SaleSphere — Ravi Web Studio', short_name: 'SaleSphere', theme_color: '#0F766E', display: 'standalone' });
    expect(cfg.region).toBe('asia-south1');
  });

  it('TC-002 FR-001 AC2 a missing mandatory key or invalid value stops with an error naming the key', () => {
    const { domain: _d, ...noDomain } = example;
    expect(() => loadClientConfig(noDomain, 'clients/x/config.json')).toThrow(/clients\/x\/config\.json[\s\S]*- domain: Required/);
    expect(() => loadClientConfig({ ...example, branding: { primary: 'blue' } })).toThrow(/branding\.primary/);
    expect(() => loadClientConfig({ ...example, region: 'us-central1' })).toThrow(/region/);
  });

  it('TC-003 FR-001 AC3 two clients: nothing of one appears in the other’s output', () => {
    const a = manifestFor(loadClientConfig({ ...example, clientId: 'alpha', companyName: 'Alpha Interiors', branding: { primary: '#B91C1C' } }));
    const b = manifestFor(loadClientConfig({ ...example, clientId: 'beta', companyName: 'Beta Tutors', branding: { primary: '#1D4ED8' } }));
    expect(JSON.stringify(a)).not.toMatch(/Beta|1D4ED8/);
    expect(JSON.stringify(b)).not.toMatch(/Alpha|B91C1C/);
  });
});
