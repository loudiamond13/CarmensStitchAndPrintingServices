import { describe, expect, it } from 'vitest';
import { PUBLIC_NAME_MAX, publicWebsiteSchema, toPublicWebsiteRequest } from '@/modules/admin/publicWebsiteSchemas';
import { ORDER_VERSION } from '@/test/orderFixtures';

// The Public Website window rules (OR-3; plan 11-27): the browser checks every rule of the order's public settings before a request is
// sent, with the server's own words (OrderPublicSettings.cs).

const LINE = '8c1f4a20-0000-4000-8000-000000000001';

/** The message of the first issue at `path`, or null when that field passes. */
function messageAt(hasTeam: boolean, input: unknown, path: string): string | null {
  const result = publicWebsiteSchema(hasTeam).safeParse(input);
  if (result.success) {
    return null;
  }
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message ?? null;
}

const SHOWN = { customerConsent: true, showOnWebsite: true, productLineId: LINE, publicName: '' };

describe('publicWebsiteSchema: showing needs the customer OK (D-11)', () => {
  it('refuses Show on the website while the customer OK is unticked', () => {
    expect(messageAt(true, { ...SHOWN, customerConsent: false }, 'showOnWebsite')).toBe(
      'Tick Customer said OK to show first.',
    );
  });

  it('accepts a shown order with the OK, a line and a team on the order', () => {
    expect(publicWebsiteSchema(true).safeParse(SHOWN).success).toBe(true);
  });

  it('accepts a form with nothing ticked and nothing chosen', () => {
    expect(
      publicWebsiteSchema(true).safeParse({
        customerConsent: false,
        showOnWebsite: false,
        productLineId: '',
        publicName: '',
      }).success,
    ).toBe(true);
  });

  it('allows the OK without showing', () => {
    expect(publicWebsiteSchema(true).safeParse({ ...SHOWN, showOnWebsite: false, productLineId: '' }).success).toBe(
      true,
    );
  });
});

describe('publicWebsiteSchema: the line (D-09)', () => {
  it('asks for a line when the order is shown with none', () => {
    expect(messageAt(true, { ...SHOWN, productLineId: '' }, 'productLineId')).toBe(
      'Choose the product line to show this order under.',
    );
  });

  it('does not ask for a line while the order is not shown', () => {
    expect(messageAt(true, { ...SHOWN, showOnWebsite: false, productLineId: '' }, 'productLineId')).toBeNull();
  });
});

describe('publicWebsiteSchema: the name shown (D-13)', () => {
  it('accepts a name of 80 characters and refuses one of 81', () => {
    expect(messageAt(true, { ...SHOWN, publicName: 'a'.repeat(80) }, 'publicName')).toBeNull();
    expect(messageAt(true, { ...SHOWN, publicName: 'a'.repeat(81) }, 'publicName')).toBe(
      'Keep the name to 80 characters or fewer.',
    );
  });

  it('counts the name without the spaces around it', () => {
    expect(messageAt(true, { ...SHOWN, publicName: `  ${'a'.repeat(80)}  ` }, 'publicName')).toBeNull();
  });

  it('refuses a name that is too long even while the order is not shown', () => {
    expect(
      messageAt(true, { ...SHOWN, showOnWebsite: false, productLineId: '', publicName: 'a'.repeat(81) }, 'publicName'),
    ).toBe('Keep the name to 80 characters or fewer.');
  });

  it('asks for a name when the order is shown, has no team and no name was typed', () => {
    const message = 'This order has no team name. Enter the name to show.';

    expect(messageAt(false, { ...SHOWN, publicName: '' }, 'publicName')).toBe(message);
    expect(messageAt(false, { ...SHOWN, publicName: '   ' }, 'publicName')).toBe(message);
  });

  it('is content with the team when there is one, or with a typed name when there is no team', () => {
    expect(messageAt(true, { ...SHOWN, publicName: '' }, 'publicName')).toBeNull();
    expect(messageAt(false, { ...SHOWN, publicName: 'Sample Ballers' }, 'publicName')).toBeNull();
  });

  it('does not ask for a name while the order is not shown', () => {
    expect(
      messageAt(
        false,
        { customerConsent: true, showOnWebsite: false, productLineId: '', publicName: '' },
        'publicName',
      ),
    ).toBeNull();
  });
});

describe('toPublicWebsiteRequest', () => {
  it('sends the ticks, the line, the name and the order version', () => {
    expect(toPublicWebsiteRequest({ ...SHOWN, publicName: 'Sample Ballers' }, ORDER_VERSION)).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: LINE,
      publicName: 'Sample Ballers',
      version: ORDER_VERSION,
    });
  });

  it('sends no line and no name when they are empty or blank', () => {
    expect(
      toPublicWebsiteRequest(
        { customerConsent: true, showOnWebsite: false, productLineId: '', publicName: '   ' },
        ORDER_VERSION,
      ),
    ).toEqual({
      customerConsent: true,
      showOnWebsite: false,
      productLineId: null,
      publicName: null,
      version: ORDER_VERSION,
    });
  });

  it('trims the name', () => {
    expect(toPublicWebsiteRequest({ ...SHOWN, publicName: '  Sample Ballers  ' }, ORDER_VERSION).publicName).toBe(
      'Sample Ballers',
    );
  });
});

describe('PUBLIC_NAME_MAX', () => {
  it('is the 80 characters of OrderPublicSettings.PublicNameMaxLength', () => {
    expect(PUBLIC_NAME_MAX).toBe(80);
  });
});
