#!/usr/bin/env node
/**
 * Test-coverage view of the RTM (Phase 12/13): for every FR, how many of its TCs (docs/08-test/test-cases/index.json)
 * are referenced by an automated test, and whether any automated test names the FR.
 * Writes docs/09-traceability/TEST-COVERAGE.md. Exit code 1 if any Must FR has no automated test.
 * Usage: node infra/rtm-coverage.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIRS = ['packages/domain/test', 'packages/config/test', 'packages/doc-templates/test', 'apps/api/test', 'apps/web/e2e', 'apps/web/functions'];
const frd = readFileSync('docs/02-frd/FRD.md', 'utf8');
const frs = [];
const re = /^### (FR-\d{3}) — (.+)\n\|[^\n]*\n\|[^\n]*\n\| *([^|]+)\|([^|]+)\|([^|]+)\|/gm;
for (let m; (m = re.exec(frd)); ) frs.push({ id: m[1], title: m[2].trim(), mod: m[3].trim(), prio: m[5].trim() });
const tcs = JSON.parse(readFileSync('docs/08-test/test-cases/index.json', 'utf8'));

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (f === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(spec|test)\.ts$/.test(f)) files.push(p.replace(/\\/g, '/'));
  }
};
for (const d of TEST_DIRS) walk(d);
const byFile = files.map((f) => ({ f, text: readFileSync(f, 'utf8') }));
const tcHit = new Set(byFile.flatMap(({ text }) => text.match(/TC-\d+[a-z]?/g) ?? []));
const where = (id) => byFile.filter(({ text }) => text.includes(id)).map(({ f }) => f.split('/').slice(-2).join('/'));

const rows = frs.map((f) => {
  const mine = tcs.filter((t) => t.fr === f.id);
  const auto = mine.filter((t) => tcHit.has(t.id));
  const files = [...new Set([...where(f.id), ...auto.flatMap((t) => where(t.id))])];
  return { ...f, tcs: mine.length, auto: auto.length, files, covered: auto.length > 0 || files.length > 0 };
});
const must = rows.filter((r) => r.prio === 'Must');
const gaps = must.filter((r) => !r.covered);
const tcAuto = tcs.filter((t) => tcHit.has(t.id)).length;

const out = `# Test Coverage by Requirement — SaleSphere CRM

| Version | Date | Author | Change |
|---|---|---|---|
| generated | ${new Date().toISOString().slice(0, 10)} | infra/rtm-coverage.mjs | Regenerate with \`node infra/rtm-coverage.mjs\` |

## 1. Summary

| Measure | Value |
|---|---|
| FRs | ${frs.length} (Must ${must.length}) |
| Must FRs with at least one automated test | **${must.length - gaps.length} / ${must.length}** |
| Test cases automated | ${tcAuto} / ${tcs.length} (${Math.round((tcAuto / tcs.length) * 100)} %) |
| Remaining test cases | ${tcs.length - tcAuto}: executed manually in UAT (docs/08-test/TEST-STRATEGY.md) |
| Must FRs without an automated test | ${gaps.length ? gaps.map((g) => g.id).join(', ') : 'none'} |

## 2. Per requirement

| FR | Title | Priority | TCs automated | Automated in |
|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.title} | ${r.prio} | ${r.auto} / ${r.tcs} | ${r.files.join(', ') || '—'} |`).join('\n')}
`;
writeFileSync('docs/09-traceability/TEST-COVERAGE.md', out);
console.warn(`Must FRs covered ${must.length - gaps.length}/${must.length}; TCs automated ${tcAuto}/${tcs.length}`);
if (gaps.length) process.exit(1);
