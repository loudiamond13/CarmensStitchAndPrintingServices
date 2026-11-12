// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoSiteSettings } from '@/test/siteContentFixtures';
import {
  businessInfoSchema,
  businessInfoValuesOf,
  hasBracketPlaceholder,
  isDirectionsLink,
  isFacebookLink,
  isInstagramLink,
  isMapEmbedLink,
  isMessengerLink,
  isTikTokLink,
  phoneE164,
  reduceEmbedCode,
  toSiteSettingsRequest,
  type BusinessInfoInput,
} from './siteContentSchemas';

// The Business Info form schema (OR-3; CONT-01, D-23, D-24; plan 11-12): it mirrors the server's validator, so the browser checks
// every rule the server checks before a request is sent, with the server's own words. The phone and link cases are the files the
// .NET tests read too (tests/fixtures/philippine-phone-cases.json, tests/fixtures/site-link-cases.json).

interface PhoneCases {
  accept: { input: string; e164: string; display: string }[];
  refuse: string[];
}

interface LinkGroup {
  accept: string[];
  refuse: string[];
}

interface LinkCases {
  messenger: LinkGroup;
  facebook: LinkGroup;
  instagram: LinkGroup;
  tiktok: LinkGroup;
  directions: LinkGroup;
  embed: LinkGroup;
  refuseEverywhere: string[];
}

const phoneCases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/philippine-phone-cases.json', import.meta.url), 'utf8'),
) as PhoneCases;

const linkCases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/site-link-cases.json', import.meta.url), 'utf8'),
) as LinkCases;

const GOOD: BusinessInfoInput = businessInfoValuesOf(demoSiteSettings);

type PathPart = string | number;

/** Every message the schema gives for `values`, keyed by the dotted path of its field ("phones.0.number"). */
function issues(values: BusinessInfoInput): Map<string, string[]> {
  const result = businessInfoSchema.safeParse(values);
  const byPath = new Map<string, string[]>();
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = (issue.path as PathPart[]).join('.');
      byPath.set(key, [...(byPath.get(key) ?? []), issue.message]);
    }
  }
  return byPath;
}

function messagesFor(values: BusinessInfoInput, path: string): string[] {
  return issues(values).get(path) ?? [];
}

function withValue(patch: Partial<BusinessInfoInput>): BusinessInfoInput {
  return { ...GOOD, ...patch };
}

describe('the saved settings pass every rule', () => {
  it('accepts the demo shop as it is', () => {
    expect(issues(GOOD).size).toBe(0);
  });

  it('accepts a shop with every optional value left out and one number', () => {
    const bare = withValue({
      aboutText: '',
      turnaroundLine: '',
      postalCode: '',
      directionsUrl: '',
      mapEmbedUrl: '',
      messengerUrl: '',
      facebookUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
      contactEmail: '',
      phones: [{ number: '0917 123 4567', label: '', isMain: true }],
    });

    expect(issues(bare).size).toBe(0);
  });
});

describe('the shared phone cases (tests/fixtures/philippine-phone-cases.json)', () => {
  it.each(phoneCases.accept)('reads $input as $e164', ({ input, e164 }) => {
    expect(phoneE164(input)).toBe(e164);
  });

  it.each(phoneCases.refuse)('refuses the number %j', (input) => {
    expect(phoneE164(input)).toBeNull();
  });

  it('gives the server message under the number of the row that is refused', () => {
    const values = withValue({ phones: [{ number: '0917 123 456', label: '', isMain: true }] });

    expect(messagesFor(values, 'phones.0.number')).toEqual([
      'Enter a phone number, like 0917 123 4567 or 02 8123 4567.',
    ]);
  });

  it('strips round brackets and nothing else: a number in square brackets is refused', () => {
    expect(phoneE164('(02) 8123 4567')).toBe('+63281234567');
    expect(phoneE164('[0917 000 0000]')).toBeNull();
  });
});

describe('the shared link cases (tests/fixtures/site-link-cases.json)', () => {
  const rules = {
    messenger: isMessengerLink,
    facebook: isFacebookLink,
    instagram: isInstagramLink,
    tiktok: isTikTokLink,
    directions: isDirectionsLink,
    embed: isMapEmbedLink,
  } as const;

  for (const [name, rule] of Object.entries(rules)) {
    const group = linkCases[name as keyof typeof rules];

    it.each(group.accept)(`${name} accepts %j`, (link) => {
      expect(rule(link)).toBe(true);
    });

    it.each(group.refuse)(`${name} refuses %j`, (link) => {
      expect(rule(link)).toBe(false);
    });

    it.each(linkCases.refuseEverywhere)(`${name} refuses %j (every link rule does)`, (link) => {
      expect(rule(link)).toBe(false);
    });
  }

  it('treats an empty or blank link as not set, which is no error in the form', () => {
    const values = withValue({ messengerUrl: '', facebookUrl: '   ', instagramUrl: '', tiktokUrl: '' });

    expect(issues(values).size).toBe(0);
  });

  it.each([
    ['messengerUrl', 'https://evil.example/m.me/x', 'Paste your Messenger link, like https://m.me/yourpage.'],
    [
      'facebookUrl',
      'https://l.facebook.com/x',
      'Paste your Facebook page link, like https://www.facebook.com/yourpage.',
    ],
    ['instagramUrl', 'https://instagr.am/x', 'Paste your Instagram link, like https://www.instagram.com/yourpage.'],
    ['tiktokUrl', 'https://vm.tiktok.com/x', 'Paste your TikTok link, like https://www.tiktok.com/@yourpage.'],
    ['directionsUrl', 'javascript:alert(1)', 'Paste a Google Maps link, like https://maps.app.goo.gl/abc123.'],
    [
      'mapEmbedUrl',
      'https://www.google.com/maps?q=sample',
      'Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.',
    ],
  ] as const)('gives the %s message for a refused link', (field, link, message) => {
    expect(messagesFor(withValue({ [field]: link }), field)).toEqual([message]);
  });

  it.each([
    ['facebookUrl', `https://www.facebook.com/${'a'.repeat(280)}`, 300],
    ['instagramUrl', `https://www.instagram.com/${'a'.repeat(280)}`, 300],
    ['tiktokUrl', `https://www.tiktok.com/@${'a'.repeat(280)}`, 300],
    ['directionsUrl', `https://maps.app.goo.gl/${'a'.repeat(300)}`, 300],
    ['mapEmbedUrl', `https://www.google.com/maps/embed?pb=${'a'.repeat(1000)}`, 1000],
  ] as const)(
    'gives the server length message for a %s that is on an allowed host and over its column',
    (field, link, max) => {
      expect(messagesFor(withValue({ [field]: link }), field)).toEqual([
        `Keep this to ${String(max)} characters or fewer.`,
      ]);
    },
  );

  it('accepts a link on an allowed host that is exactly as long as its column', () => {
    const link = `https://www.facebook.com/${'a'.repeat(275)}`;

    expect(link).toHaveLength(300);
    expect(issues(withValue({ facebookUrl: link })).size).toBe(0);
  });
});

describe('every UI-SPEC Business Info row (the same list as the server validator)', () => {
  it.each([
    ['businessName', '', 'Enter the business name.'],
    ['businessName', '   ', 'Enter the business name.'],
    ['businessName', 'a'.repeat(101), 'Keep the business name to 100 characters or fewer.'],
    ['tagline', '', 'Enter a tagline.'],
    ['tagline', 'a'.repeat(161), 'Keep the tagline to 160 characters or fewer.'],
    ['turnaroundLine', 'a'.repeat(121), 'Keep the turnaround line to 120 characters or fewer.'],
    ['aboutText', 'a'.repeat(601), 'Keep this to 600 characters or fewer.'],
    ['street', '', 'Enter the street and barangay.'],
    ['street', 'a'.repeat(121), 'Keep this to 120 characters or fewer.'],
    ['townOrCity', '', 'Enter the town or city.'],
    ['townOrCity', 'a'.repeat(61), 'Keep this to 60 characters or fewer.'],
    ['province', '', 'Enter the province.'],
    ['province', 'a'.repeat(61), 'Keep this to 60 characters or fewer.'],
    ['postalCode', '860', 'Use the 4-digit postal code, like 8600.'],
    ['postalCode', '86000', 'Use the 4-digit postal code, like 8600.'],
    ['postalCode', 'abcd', 'Use the 4-digit postal code, like 8600.'],
    ['postalCode', '٨٦٠٠', 'Use the 4-digit postal code, like 8600.'],
    ['contactEmail', 'nope', 'Enter a valid email, like name@gmail.com'],
    ['contactEmail', 'a@b@c.ph', 'Enter a valid email, like name@gmail.com'],
    ['contactEmail', `${'a'.repeat(250)}@b.ph`, 'Enter a valid email, like name@gmail.com'],
    ['contactEmail', 'name@[example].ph', 'Enter a valid email, like name@gmail.com'],
  ] as const)('gives %s the message for %j', (field, value, message) => {
    expect(messagesFor(withValue({ [field]: value }), field)).toEqual([message]);
  });

  it.each([
    ['businessName', 'Sample Shop'.padEnd(100, 'x')],
    ['tagline', 'a'.repeat(160)],
    ['turnaroundLine', 'a'.repeat(120)],
    ['aboutText', 'a'.repeat(600)],
    ['postalCode', '8600'],
    ['postalCode', ' 8600 '],
    ['contactEmail', 'name@gmail.com'],
    ['contactEmail', ''],
  ] as const)('accepts %s as %j', (field, value) => {
    expect(messagesFor(withValue({ [field]: value }), field)).toEqual([]);
  });

  it('counts a 100-character business name with an n-tilde as 100 and a 101-character one as too long', () => {
    expect(messagesFor(withValue({ businessName: 'ñ'.repeat(100) }), 'businessName')).toEqual([]);
    expect(messagesFor(withValue({ businessName: 'ñ'.repeat(101) }), 'businessName')).toEqual([
      'Keep the business name to 100 characters or fewer.',
    ]);
  });

  it('counts a length after the trim, as the server does', () => {
    expect(messagesFor(withValue({ tagline: `  ${'a'.repeat(160)}  ` }), 'tagline')).toEqual([]);
  });

  it('refuses text that still holds a square-bracket placeholder, with the server wording', () => {
    const message = 'Replace the text in square brackets with the real words.';

    for (const field of [
      'businessName',
      'tagline',
      'aboutText',
      'turnaroundLine',
      'street',
      'townOrCity',
      'province',
    ] as const) {
      expect(messagesFor(withValue({ [field]: '[Shop address]' }), field), field).toEqual([message]);
    }
    expect(
      messagesFor(
        withValue({ phones: [{ number: '0917 123 4567', label: '[Globe]', isMain: true }] }),
        'phones.0.label',
      ),
    ).toEqual([message]);
  });

  it('says a bracket in a required text is a placeholder only after the length rules have passed', () => {
    expect(messagesFor(withValue({ businessName: '' }), 'businessName')).toEqual(['Enter the business name.']);
    expect(hasBracketPlaceholder('[x]')).toBe(true);
    expect(hasBracketPlaceholder('x]')).toBe(false);
    expect(hasBracketPlaceholder('][')).toBe(false);
    expect(hasBracketPlaceholder('plain')).toBe(false);
  });
});

describe('the phone list (D-23)', () => {
  const row = (number: string, isMain = false, label = '') => ({ number, label, isMain });

  it('needs at least one number, shown on the list', () => {
    expect(messagesFor(withValue({ phones: [] }), 'phones.root')).toEqual(['Add at least one phone number.']);
  });

  it('allows up to 4 numbers and refuses a fifth', () => {
    const four = [row('0917 123 4567', true), row('0918 123 4567'), row('0919 123 4567'), row('0920 123 4567')];

    expect(issues(withValue({ phones: four })).size).toBe(0);
    expect(messagesFor(withValue({ phones: [...four, row('0921 123 4567')] }), 'phones.root')).toEqual([
      'You can list up to 4 numbers.',
    ]);
  });

  it('needs exactly one main number', () => {
    const none = withValue({ phones: [row('0917 123 4567'), row('0918 123 4567')] });
    const two = withValue({ phones: [row('0917 123 4567', true), row('0918 123 4567', true)] });

    expect(messagesFor(none, 'phones.root')).toEqual(['Choose the main number.']);
    expect(messagesFor(two, 'phones.root')).toEqual(['Choose the main number.']);
  });

  it('refuses a number that is listed twice, whatever way it is written, on the later row', () => {
    const values = withValue({ phones: [row('0917 123 4567', true), row('+63 917 123 4567')] });

    expect(messagesFor(values, 'phones.0.number')).toEqual([]);
    expect(messagesFor(values, 'phones.1.number')).toEqual(['This number is already listed.']);
  });

  it('refuses a label over 20 characters and accepts one of exactly 20', () => {
    const long = withValue({ phones: [row('0917 123 4567', true, 'a'.repeat(21))] });
    const exact = withValue({ phones: [row('0917 123 4567', true, 'a'.repeat(20))] });

    expect(messagesFor(long, 'phones.0.label')).toEqual(['Keep the label to 20 characters or fewer.']);
    expect(messagesFor(exact, 'phones.0.label')).toEqual([]);
  });

  it('needs a number in every row', () => {
    const values = withValue({ phones: [row('0917 123 4567', true), row('')] });

    expect(messagesFor(values, 'phones.1.number')).toEqual([
      'Enter a phone number, like 0917 123 4567 or 02 8123 4567.',
    ]);
  });
});

describe('reduceEmbedCode (T-11-29)', () => {
  const link = 'https://www.google.com/maps/embed?pb=x';

  it('keeps only the src link of a pasted Google embed code', () => {
    const code = `<iframe src="${link}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

    expect(reduceEmbedCode(code)).toBe(link);
  });

  it('reads a single-quoted src and ignores the case of the attribute name', () => {
    expect(reduceEmbedCode(`<IFRAME SRC='${link}'></IFRAME>`)).toBe(link);
  });

  it('turns an escaped ampersand in the src back into an ampersand', () => {
    expect(reduceEmbedCode('<iframe src="https://www.google.com/maps/embed?pb=x&amp;hl=en"></iframe>')).toBe(
      'https://www.google.com/maps/embed?pb=x&hl=en',
    );
  });

  it('leaves a plain link unchanged', () => {
    expect(reduceEmbedCode(link)).toBe(link);
  });

  it('trims the text around a link', () => {
    expect(reduceEmbedCode(`  ${link}  `)).toBe(link);
  });

  it('leaves the text as typed when the src is not a Google embed link, so the rule refuses it', () => {
    const code = '<iframe src="https://evil.example/embed?x=1"></iframe>';

    expect(reduceEmbedCode(code)).toBe(code);
    expect(reduceEmbedCode('<iframe src="javascript:alert(1)"></iframe>')).toBe(
      '<iframe src="javascript:alert(1)"></iframe>',
    );
  });

  it('leaves text with no src as typed', () => {
    expect(reduceEmbedCode('hello')).toBe('hello');
    expect(reduceEmbedCode('')).toBe('');
  });

  it('never lets a hostile src through: only the first src is read and it must start with the embed prefix', () => {
    const code = `<iframe src="https://evil.example/x" data-src="${link}"></iframe>`;

    expect(reduceEmbedCode(code)).toBe(code);
  });
});

describe('the save request (CONT-01)', () => {
  it('maps the saved settings back to the request they came from, with the version', () => {
    const request = toSiteSettingsRequest(GOOD, demoSiteSettings.version);

    expect(request.version).toBe(demoSiteSettings.version);
    expect(request.businessName).toBe(demoSiteSettings.businessName);
    expect(request.phones).toEqual(demoSiteSettings.phones);
    expect(request.tiktokUrl).toBeNull();
    expect(request.turnaroundLine).toBeNull();
  });

  it('trims every text and sends an empty optional value as null', () => {
    const request = toSiteSettingsRequest(
      withValue({
        businessName: '  Sample Shop  ',
        aboutText: '   ',
        postalCode: ' 8600 ',
        phones: [{ number: ' 0917 123 4567 ', label: '  ', isMain: true }],
      }),
      'v1',
    );

    expect(request.businessName).toBe('Sample Shop');
    expect(request.aboutText).toBeNull();
    expect(request.postalCode).toBe('8600');
    expect(request.phones).toEqual([{ number: '0917 123 4567', label: null, isMain: true }]);
  });
});
