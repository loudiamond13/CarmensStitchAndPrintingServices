// @vitest-environment node
// TOOL-WR-05: the D-32 icon-drawing mask covers only icon wrappers, marked per side: the App. D.3 `Icon` (class
// csp-icon) on the reference side and the lucide-react wrapper (class lucide, pinned by src/components/brand/Icon.test.tsx) on
// the implementation side. Any other 24 x 24 SVG (a spinner, a check mark, a chevron drawn in place) is still compared.
import { afterEach, describe, expect, it } from 'vitest';
import { collectInPage } from './compare.ts';
import { iconSelector, maskedIcon, STRUCTURAL_EXCEPTIONS, assertRegistry } from './intentional-differences.ts';

interface FakeElement {
  readonly localName: string;
  readonly children: FakeElement[];
  readonly attributes: { name: string; value: string }[];
  getAttribute(name: string): string | null;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

function fake(localName: string, attributes: Record<string, string>, children: FakeElement[] = []): FakeElement {
  return {
    localName,
    children,
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
    getAttribute: (name) => attributes[name] ?? null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 24, height: 24 }),
  };
}

const scope = globalThis as unknown as Record<string, unknown>;
afterEach(() => {
  delete scope.document;
  delete scope.getComputedStyle;
});

/** Runs the in-page walker over `root` with a fake document (every element displayed, no pseudo content). */
function collect(root: FakeElement, icon: { viewBox: string; className: string } | null) {
  scope.document = { querySelector: () => root };
  scope.getComputedStyle = () => ({ getPropertyValue: (property: string) => (property === 'content' ? 'none' : '') });
  const record = collectInPage({ selector: '[data-case]', properties: ['display', 'content'], icon });
  return Object.fromEntries((record?.elements ?? []).map((element) => [element.path, element.icon]));
}

const VIEWBOX = '0 0 24 24';

describe('collectInPage marks only marked icon wrappers (TOOL-WR-05)', () => {
  const tree = (): FakeElement =>
    fake('div', {}, [
      fake('svg', { viewBox: VIEWBOX, class: 'inline-block lucide lucide-plus' }, [fake('path', { d: 'M5 12h14' })]),
      fake('svg', { viewBox: VIEWBOX, class: 'spinner' }, [fake('circle', { r: '10' })]),
      fake('svg', { viewBox: VIEWBOX }, [fake('path', { d: 'M9 12l2 2 4-4' })]),
      fake('svg', { viewBox: '0 0 512 512', class: 'lucide' }),
    ]);

  it('marks a 24 x 24 svg with the side class as an icon', () => {
    expect(collect(tree(), { viewBox: VIEWBOX, className: 'lucide' })['0/0']).toBe(true);
  });

  it('leaves a 24 x 24 svg without the class compared (spinner, drawn check mark)', () => {
    const icons = collect(tree(), { viewBox: VIEWBOX, className: 'lucide' });
    expect(icons['0/1']).toBe(false);
    expect(icons['0/2']).toBe(false);
  });

  it('leaves an svg with the class but another viewBox compared', () => {
    expect(collect(tree(), { viewBox: VIEWBOX, className: 'lucide' })['0/3']).toBe(false);
  });

  it('marks nothing when the registry masks no drawing', () => {
    expect(Object.values(collect(tree(), null)).some(Boolean)).toBe(false);
  });
});

describe('the D-32 mask in the registry', () => {
  it('names the icon wrapper class of each side', () => {
    expect(maskedIcon('reference')).toEqual({ viewBox: VIEWBOX, className: 'csp-icon' });
    expect(maskedIcon('impl')).toEqual({ viewBox: VIEWBOX, className: 'lucide' });
    expect(maskedIcon('impl', [])).toBeNull();
  });

  it('builds the screenshot mask selector from the class and the viewBox', () => {
    expect(iconSelector({ viewBox: VIEWBOX, className: 'csp-icon' })).toBe('svg.csp-icon[viewBox="0 0 24 24"]');
  });

  it('rejects a mask whose class is not a plain class name', () => {
    const mask = STRUCTURAL_EXCEPTIONS.find((entry) => entry.kind === 'icon-drawing');
    if (mask?.kind !== 'icon-drawing') {
      throw new Error('The registry has no D-32 icon-drawing mask.');
    }
    expect(() => {
      assertRegistry([{ ...mask, implClass: 'lucide, svg' }], []);
    }).toThrow(/plain class name/);
  });
});
