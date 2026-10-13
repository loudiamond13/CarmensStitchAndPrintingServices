// @vitest-environment node
// TOOL-WR-04: the reference kit merges the frozen App. D.3 components with the layout fragments. A fragment that reuses a
// frozen component's name would replace the approved design with hand-written code, so a clash fails unless the name is
// on the decision-tagged SPEC_OVERRIDES list (only Topbar, D-41 R2-04).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractAppendices, SPEC_PATH } from './extract-spec.mjs';
import { mergeKit, SPEC_OVERRIDES } from './merge-kit';

const Button = (): null => null;
const Badge = (): null => null;
const PublicShell = (): null => null;
const HandWrittenButton = (): null => null;

describe('mergeKit (TOOL-WR-04)', () => {
  it('keeps PascalCase function exports from the spec and every fragment', () => {
    const kit = mergeKit({ Button, Badge, formatPeso: () => '', STATUS: {} }, [{ PublicShell }]);
    expect(Object.keys(kit).toSorted()).toEqual(['Badge', 'Button', 'PublicShell']);
    expect(kit.Button).toBe(Button);
    expect(Object.isFrozen(kit)).toBe(true);
  });

  it('fails when a fragment shadows a frozen spec component', () => {
    expect(() => mergeKit({ Button, Badge }, [{ Button: HandWrittenButton }])).toThrow(
      /shadow frozen spec components: Button/,
    );
  });

  it('fails when two fragments export the same component name', () => {
    expect(() => mergeKit({ Button }, [{ PublicShell }, { PublicShell }])).toThrow(
      /more than one fragment: PublicShell/,
    );
  });

  it('lets a fragment replace a frozen component only when the name is on the decision-tagged list', () => {
    const kit = mergeKit({ Button }, [{ Button: HandWrittenButton }], new Map([['Button', 'D-99']]));
    expect(kit.Button).toBe(HandWrittenButton);
  });

  it('approves exactly one override: Topbar, by D-41 (R2-04, the shortcut hint text)', () => {
    expect([...SPEC_OVERRIDES]).toEqual([['Topbar', 'D-41']]);
  });
});

// The real fragments against the real frozen namespace, by name: the frozen App. D.3 exports are read from the pinned
// spec text (CSPS-UI-SPEC.md, through extract-spec.mjs, so no extraction is needed) and the fragments' exports from
// their source, then both are merged as stand-ins. Only the D-41 Topbar may shadow a frozen component.
describe('mergeKit with the real fragments and the frozen App. D.3 names', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const d3 = extractAppendices(readFileSync(SPEC_PATH, 'utf8')).get('ui/index.tsx') ?? '';
  const stub = (): null => null;
  const namespaceOf = (source: string): Record<string, () => null> =>
    Object.fromEntries([...source.matchAll(/^export function ([A-Z]\w*)/gm)].map((match) => [match[1] ?? '', stub]));
  const specNames = namespaceOf(d3);
  const fragments = readdirSync(path.join(here, 'fragments'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => namespaceOf(readFileSync(path.join(here, 'fragments', file), 'utf8')));

  it('reads the frozen components and the fragments (Topbar is both)', () => {
    expect(Object.keys(specNames)).toContain('Topbar');
    expect(Object.keys(specNames)).toContain('Sidebar');
    expect(fragments.some((fragment) => Object.hasOwn(fragment, 'Topbar'))).toBe(true);
  });

  it('merges without a clash under SPEC_OVERRIDES', () => {
    expect(() => mergeKit(specNames, fragments)).not.toThrow();
  });

  it('fails on the Topbar fragment without its D-41 entry, and on any other frozen name a fragment shadows', () => {
    expect(() => mergeKit(specNames, fragments, new Map())).toThrow(/shadow frozen spec components: Topbar/);
    expect(() => mergeKit(specNames, [...fragments, { Sidebar: stub }])).toThrow(
      /shadow frozen spec components: Sidebar/,
    );
  });
});
