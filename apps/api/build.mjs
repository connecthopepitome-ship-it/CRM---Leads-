/**
 * Builds the Cloud Functions deploy bundle (HLD §12): apps/api/dist/{functions.js, package.json}.
 * Workspace packages (@ss/*) are bundled in; npm dependencies stay external and are listed in
 * dist/package.json so Cloud Build can `npm install` them (it cannot resolve `workspace:*`).
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const deps = Object.fromEntries(Object.entries(pkg.dependencies).filter(([n]) => !n.startsWith('@ss/')));

mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/functions.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/functions.js',
  sourcemap: true,
  external: Object.keys(deps),
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync('dist/package.json', `${JSON.stringify({ name: 'salesphere-functions', version: pkg.version, private: true, type: 'module', main: 'functions.js', engines: { node: '22' }, dependencies: deps }, null, 2)}\n`);
console.warn(`dist/functions.js built; ${Object.keys(deps).length} runtime dependencies in dist/package.json`);
