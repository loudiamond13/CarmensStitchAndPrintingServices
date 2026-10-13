// @vitest-environment node
// TOOL-WR-04: the reference kit merges the frozen App. D.3 components with the layout fragments. A fragment that reuses a
// frozen component's name would replace the approved design with hand-written code, so a clash fails unless the name is
// on the decision-tagged SPEC_OVERRIDES list (empty today).
import { describe, expect, it } from 'vitest';
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

  it('approves no override today', () => {
    expect([...SPEC_OVERRIDES]).toEqual([]);
  });
});
