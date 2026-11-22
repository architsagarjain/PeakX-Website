import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Vercel runs api/** as native ES modules (package.json "type": "module") without bundling, so every
 * relative import reachable from a server function must name its file with ".js". Without it Node
 * throws ERR_MODULE_NOT_FOUND and every /api route returns 500 (the R7 outage).
 */
const root = fileURLToPath(new URL('../..', import.meta.url));
const IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function reachable(): { file: string; spec: string }[] {
  const seen = new Set<string>();
  const bad: { file: string; spec: string }[] = [];
  const queue = tsFiles(join(root, 'api'));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = m[1];
      if (!spec.endsWith('.js')) { bad.push({ file: relative(root, file), spec }); continue; }
      const target = normalize(join(dirname(file), spec.replace(/\.js$/, '.ts')));
      if (existsSync(target)) queue.push(target);
    }
  }
  return bad;
}

describe('server functions load as ES modules', () => {
  it('every relative import reachable from api/ ends in .js', () => {
    expect(reachable()).toEqual([]);
  });
});
