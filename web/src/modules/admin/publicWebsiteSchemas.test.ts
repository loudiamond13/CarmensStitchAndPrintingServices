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
