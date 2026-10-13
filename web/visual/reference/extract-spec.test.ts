// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  APPENDIX_FILES,
  compareWithPin,
  extractAppendices,
  framedHashAppendices,
  hashAppendices,
  pinTextFor,
  runExtract,
} from './extract-spec.mjs';

const specPath = fileURLToPath(new URL('../../../CSPS-UI-SPEC.md', import.meta.url));
const pinPath = fileURLToPath(new URL('./spec-appendix.sha256', import.meta.url));
const rawSpec = readFileSync(specPath, 'utf8');
const lfSpec = rawSpec.replace(/\r\n/g, '\n');

const FENCE = '```';

/** The committed pin, or '' before it exists. */
function readPin(): string {
  return existsSync(pinPath) ? readFileSync(pinPath, 'utf8') : '';
}

/** Heading, output path, opening fence language and the start of the block's first line, in hash order. */
const APPENDICES = [
  ['## Appendix A — src/styles/tokens.css', 'styles/tokens.css', 'css', '/* CSPS design tokens'],
  ['## Appendix A.2 — src/styles/globals.css', 'styles/globals.css', 'css', '/* CSPS — global stylesheet'],
  ['## Appendix A.3 — src/styles/compat.css', 'styles/compat.css', 'css', '/* Browser defaults the approved mockups'],
  ['## Appendix B — src/styles/components.css', 'styles/components.css', 'css', '/* CSP components'],
  ['## Appendix C — src/styles/screens.css', 'styles/screens.css', 'css', '/* CSPS screens'],
  ['## Appendix D.1 — src/lib/csps.ts', 'lib/csps.ts', 'ts', '/* CSPS — domain types'],
  ['## Appendix D.3 — src/ui/index.tsx', 'ui/index.tsx', 'tsx', '/* CSPS design-system components'],
  ['## Appendix D.4 — src/ui/mark.ts', 'ui/mark.ts', 'ts', '// CSPS mark'],
  ['## Appendix D.5 — src/ui/icons.ts', 'ui/icons.ts', 'ts', '// Lucide v0.460.0'],
] as const;

/** The block under a heading, found by string offsets (a different method from the script's line walk). */
function blockByOffsets(text: string, heading: string): { language: string; body: string } {
  const headingAt = text.indexOf(`\n${heading}\n`);
  const fenceAt = text.indexOf(`\n${FENCE}`, headingAt + 1) + 1;
  const bodyStart = text.indexOf('\n', fenceAt) + 1;
  const closeAt = text.indexOf(`\n${FENCE}\n`, bodyStart - 1);
  return { language: text.slice(fenceAt + FENCE.length, bodyStart - 1), body: text.slice(bodyStart, closeAt + 1) };
}

function concatenated(blocks: ReadonlyMap<string, string>): string {
  return APPENDICES.map(([, file]) => blocks.get(file) ?? '').join('');
}

describe('APPENDIX_FILES', () => {
  it('maps the nine approved appendix headings to their files, in hash order', () => {
    expect(Object.entries(APPENDIX_FILES)).toEqual(APPENDICES.map(([heading, file]) => [heading, file]));
  });
});

describe('extractAppendices', () => {
  const blocks = extractAppendices(rawSpec);

  it('extracts exactly the nine blocks', () => {
    expect([...blocks.keys()]).toEqual(APPENDICES.map(([, file]) => file));
  });

  it.each(APPENDICES)(
    '%s is the first fenced block under the heading, byte for byte (LF)',
    (heading, file, lang, first) => {
      const block = blocks.get(file) ?? '';
      const expected = blockByOffsets(lfSpec, heading);
      expect(expected.language).toBe(lang);
      expect(block).toBe(expected.body);
      expect(block.startsWith(first)).toBe(true);
      expect(block.endsWith('\n')).toBe(true);
      expect(block.includes('\r')).toBe(false);
      expect(block.split('\n').some((line) => line.startsWith(FENCE))).toBe(false);
    },
  );

  it('extracts the same bytes from a CRLF copy of the spec as from the LF text', () => {
    const crlf = lfSpec.replace(/\n/g, '\r\n');
    expect(extractAppendices(crlf)).toEqual(extractAppendices(lfSpec));
    expect(extractAppendices(crlf).size).toBe(9);
  });

  it('keeps all 37 exported components of App. D.3', () => {
    expect((blocks.get('ui/index.tsx') ?? '').match(/^export function /gm)?.length).toBe(37);
  });

  it('names a missing heading', () => {
    const without = lfSpec.replace('## Appendix D.4 — src/ui/mark.ts\n', '## Appendix D.4 (moved)\n');
    expect(() => extractAppendices(without)).toThrow(/Appendix D\.4 — src\/ui\/mark\.ts/);
  });

  it('names a heading that appears twice', () => {
    const twice = `${lfSpec}\n## Appendix D.5 — src/ui/icons.ts\n\n${FENCE}ts\nexport {};\n${FENCE}\n`;
    expect(() => extractAppendices(twice)).toThrow(/Appendix D\.5 — src\/ui\/icons\.ts.*more than once/);
  });

  it('names a heading whose section has no fenced block before the next heading', () => {
    const spec = '## Appendix A — src/styles/tokens.css\n\nNo code here.\n\n## Next\n\n```css\na {}\n```\n';
    expect(() => extractAppendices(spec)).toThrow(/Appendix A — src\/styles\/tokens\.css/);
  });
});

describe('the SHA-256 pin', () => {
  const blocks = extractAppendices(rawSpec);
  const pin = readPin();

  it('is the lowercase hex SHA-256 of the nine blocks concatenated in order', () => {
    const expected = createHash('sha256').update(concatenated(blocks), 'utf8').digest('hex');
    expect(hashAppendices(blocks)).toBe(expected);
    expect(pin.replace(/\r\n/g, '\n').split('\n')[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  // TOOL-WR-03: the first line alone hashes the blocks joined with no separator, so a line moved from the end of one
  // appendix to the start of the next leaves it unchanged. The second line frames each block with its file and length.
  it('holds a second, framed line: each block hashed after its file name and byte length', () => {
    const expected = createHash('sha256');
    for (const file of Object.values(APPENDIX_FILES)) {
      const text = blocks.get(file) ?? '';
      expected.update(`${file}\0${String(Buffer.byteLength(text, 'utf8'))}\0`, 'utf8');
      expected.update(text, 'utf8');
    }
    expect(framedHashAppendices(blocks)).toBe(expected.digest('hex'));
    expect(pinTextFor(blocks)).toBe(`${hashAppendices(blocks)}\nframed ${framedHashAppendices(blocks)}\n`);
  });

  it('reports a line moved from the end of one appendix to the start of the next as a mismatch', () => {
    const before = new Map(blocks);
    before.set('styles/components.css', '.a { }\n.b { }\n');
    before.set('styles/screens.css', '.c { }\n');
    const after = new Map(before);
    after.set('styles/components.css', '.a { }\n');
    after.set('styles/screens.css', '.b { }\n.c { }\n');
    expect(hashAppendices(after)).toBe(hashAppendices(before));
    expect(compareWithPin(after, pinTextFor(before)).matches).toBe(false);
  });

  it('fails a pin file that has only the unframed line', () => {
    expect(compareWithPin(blocks, `${hashAppendices(blocks)}\n`).matches).toBe(false);
  });

  it("the committed pin matches the extraction of today's spec", () => {
    expect(compareWithPin(blocks, pin)).toEqual({
      matches: true,
      actual: pinTextFor(blocks).trim(),
      pinned: pin.replace(/\r\n/g, '\n').trim(),
    });
  });

  it('a one-character change inside an appendix is reported as a mismatch', () => {
    const edited = lfSpec.replace('export function Button(', 'export function Buttom(');
    expect(edited).not.toBe(lfSpec);
    expect(compareWithPin(extractAppendices(edited), pin).matches).toBe(false);
  });

  it('an edit outside the nine appendices leaves the pin matching (only the yardstick is pinned)', () => {
    const edited = lfSpec.replace(
      "### 2.3 How the CSS is organised (don't change this)",
      '### 2.3 How the CSS is organized',
    );
    expect(edited).not.toBe(lfSpec);
    expect(compareWithPin(extractAppendices(edited), pin).matches).toBe(true);
  });
});

describe('runExtract (the CLI)', () => {
  let workDir = '';

  afterEach(() => {
    if (workDir !== '') {
      rmSync(workDir, { recursive: true, force: true });
      workDir = '';
    }
  });

  function setUp(spec: string, pinText: string): { spec: string; out: string; pin: string } {
    workDir = mkdtempSync(path.join(tmpdir(), 'csps-extract-'));
    const files = {
      spec: path.join(workDir, 'CSPS-UI-SPEC.md'),
      out: path.join(workDir, '.reference-src'),
      pin: path.join(workDir, 'spec-appendix.sha256'),
    };
    writeFileSync(files.spec, spec);
    writeFileSync(files.pin, pinText);
    return files;
  }

  function run(args: readonly string[], files: { spec: string; out: string; pin: string }) {
    const lines: string[] = [];
    const code = runExtract({
      args,
      specPath: files.spec,
      outDir: files.out,
      pinPath: files.pin,
      report: (line: string) => lines.push(line),
    });
    return { code, lines };
  }

  it('writes the nine files byte for byte and exits 0 when the pin matches', () => {
    const files = setUp(rawSpec, readPin());
    expect(run([], files).code).toBe(0);
    const blocks = extractAppendices(rawSpec);
    for (const [, file] of APPENDICES) {
      expect(readFileSync(path.join(files.out, file), 'utf8')).toBe(blocks.get(file));
    }
  });

  it('exits 1 with a plain-words message and writes nothing when the spec appendices changed', () => {
    const edited = lfSpec.replace('export function Button(', 'export function Buttom(');
    const files = setUp(edited, readPin());
    const { code, lines } = run([], files);
    expect(code).toBe(1);
    expect(lines.join('\n')).toMatch(/appendices.*changed.*--repin/is);
    expect(existsSync(files.out) ? readdirSync(files.out) : []).toEqual([]);
  });

  it('--repin rewrites the pin to the current appendices, after which a plain run passes', () => {
    const edited = lfSpec.replace('export function Button(', 'export function Buttom(');
    const files = setUp(edited, `${'0'.repeat(64)}\n`);
    expect(run(['--repin'], files).code).toBe(0);
    expect(readFileSync(files.pin, 'utf8')).toBe(pinTextFor(extractAppendices(edited)));
    expect(run([], files).code).toBe(0);
  });

  it('rejects an unknown argument', () => {
    const files = setUp(rawSpec, readPin());
    const { code, lines } = run(['--force'], files);
    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('--force');
  });
});
