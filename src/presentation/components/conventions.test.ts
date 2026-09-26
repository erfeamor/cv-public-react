import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Two repo-wide invariants that a component test cannot see from the outside.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

const SRC = join(__dirname, '..', '..');

describe('source conventions', () => {
  // api-contract § Ordering: the domain service orders, nothing here re-sorts.
  it('no .sort( or .toSorted( anywhere in src/', () => {
    const offenders = sourceFiles(SRC).filter((f) => /\.(sort|toSorted)\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no dangerouslySetInnerHTML in the presentation components', () => {
    const offenders = sourceFiles(__dirname).filter((f) =>
      readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'),
    );
    expect(offenders).toEqual([]);
  });
});
