// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  demoClosures,
  demoGalleryItems,
  demoLineDetail,
  demoOpeningHours,
  demoSiteSettings,
  demoTestimonials,
  LINE_TYPE_IDS,
} from '@/test/siteContentFixtures';
import {
  businessInfoSchema,
  businessInfoValuesOf,
  closureSchema,
  closureValuesOf,
  DEFAULT_CLOSES,
  DEFAULT_OPENS,
  galleryEditSchema,
  galleryPiecesError,
  galleryUploadSchema,
  galleryUploadValuesOf,
  hasBracketPlaceholder,
  HOURS_TIME_OPTIONS,
  hoursSchema,
  hoursValuesOf,
  isContactEmail,
  isDirectionsLink,
  isFacebookLink,
  isInstagramLink,
  isMapEmbedLink,
  isMessengerLink,
  isTikTokLink,
  phoneE164,
  productLineSchema,
  productLineValuesOf,
  readLineMinimum,
  readLinePrice,
  reduceEmbedCode,
  toClosureRequest,
  toGalleryUploadRequest,
  toOpeningHoursRequest,
  toProductLineRequest,
  testimonialSchema,
  testimonialValuesOf,
  toSiteSettingsRequest,
  toTestimonialRequest,
  weekOfValues,
  type BusinessInfoInput,
  type ClosureInput,
  type GalleryUploadInput,
  type HoursInput,
  type TestimonialInput,
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

interface EmailCases {
  contactEmail: { accept: string[]; refuse: string[] };
}

const emailCases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/email-cases.json', import.meta.url), 'utf8'),
) as EmailCases;

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
      quoteAlertsEmail: '',
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

describe('the shared email cases (tests/fixtures/email-cases.json, D-42)', () => {
  it.each(emailCases.contactEmail.accept)('accepts %j', (email) => {
    expect(isContactEmail(email)).toBe(true);
  });

  it.each(emailCases.contactEmail.refuse)('refuses %j', (email) => {
    expect(isContactEmail(email)).toBe(false);
  });

  it.each(['contactEmail', 'quoteAlertsEmail'] as const)('gives %s the same answer in the form as the rule', (field) => {
    for (const email of emailCases.contactEmail.accept) {
      expect(messagesFor(withValue({ [field]: email }), field)).toEqual([]);
    }
    for (const email of emailCases.contactEmail.refuse.filter((text) => text.trim() === text && text !== '')) {
      expect(messagesFor(withValue({ [field]: email }), field)).toEqual(['Enter a valid email, like name@gmail.com']);
    }
  });

  it('refuses an email with a line break inside even after the trim', () => {
    const email = '  a@b.com\r\nBcc: z@y.com  ';

    expect(messagesFor(withValue({ quoteAlertsEmail: email }), 'quoteAlertsEmail')).toEqual([
      'Enter a valid email, like name@gmail.com',
    ]);
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
    ['quoteAlertsEmail', 'nope', 'Enter a valid email, like name@gmail.com'],
    ['quoteAlertsEmail', 'a@b@c.ph', 'Enter a valid email, like name@gmail.com'],
    ['quoteAlertsEmail', 'name@[example].ph', 'Enter a valid email, like name@gmail.com'],
    ['quoteAlertsEmail', '@example.ph', 'Enter a valid email, like name@gmail.com'],
    ['quoteAlertsEmail', `${'a'.repeat(250)}@b.ph`, 'Keep the email to 254 characters or fewer.'],
    ['quoteAlertsEmail', `${'a'.repeat(255)}@example.ph`, 'Keep the email to 254 characters or fewer.'],
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
    ['quoteAlertsEmail', 'name@gmail.com'],
    ['quoteAlertsEmail', ''],
    ['quoteAlertsEmail', '   '],
    ['quoteAlertsEmail', 'shop@example.test'],
    ['quoteAlertsEmail', `${'a'.repeat(254 - '@example.ph'.length)}@example.ph`],
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

  it('always carries quoteAlertsEmail: the trimmed address, or null when it is empty', () => {
    const empty = toSiteSettingsRequest(withValue({ quoteAlertsEmail: '  ' }), 'v1');
    const typed = toSiteSettingsRequest(withValue({ quoteAlertsEmail: ' quotes@example.com ' }), 'v1');

    expect(Object.keys(empty)).toContain('quoteAlertsEmail');
    expect(empty.quoteAlertsEmail).toBeNull();
    expect(typed.quoteAlertsEmail).toBe('quotes@example.com');
  });

  it('fills the field from the saved address and leaves an unset one empty', () => {
    expect(businessInfoValuesOf({ ...demoSiteSettings, quoteAlertsEmail: 'quotes@example.com' }).quoteAlertsEmail).toBe(
      'quotes@example.com',
    );
    expect(businessInfoValuesOf(demoSiteSettings).quoteAlertsEmail).toBe('');
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

// The weekly hours form (OR-3; CONT-01, D-21; plan 11-16): it mirrors UpdateOpeningHoursRequestValidator and OpeningHours.Check.
describe('hoursSchema', () => {
  const WEEK: HoursInput = hoursValuesOf(demoOpeningHours);

  /** The demo week with one day changed. */
  function withDay(index: number, change: Partial<HoursInput['days'][number]>): HoursInput {
    return { days: WEEK.days.map((day, at) => (at === index ? { ...day, ...change } : day)) };
  }

  /** The messages of a week, keyed by the path of the field they belong to ("days.6.closesAt"). */
  function messagesOf(values: HoursInput): Record<string, string> {
    const result = hoursSchema.safeParse(values);
    if (result.success) {
      return {};
    }
    return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
  }

  it('offers every half hour from 5:00 AM to 11:30 PM, written like 9:00 AM', () => {
    expect(HOURS_TIME_OPTIONS).toHaveLength(38);
    expect(HOURS_TIME_OPTIONS[0]).toEqual({ value: '05:00', label: '5:00 AM' });
    expect(HOURS_TIME_OPTIONS[8]).toEqual({ value: '09:00', label: '9:00 AM' });
    expect(HOURS_TIME_OPTIONS.at(-1)).toEqual({ value: '23:30', label: '11:30 PM' });
  });

  it('takes the demo week: six open days and a closed Sunday', () => {
    expect(WEEK.days.map((day) => day.open)).toEqual([true, true, true, true, true, true, false]);
    expect(hoursSchema.safeParse(WEEK).success).toBe(true);
  });

  it('refuses an open day with no opening time with the server message', () => {
    expect(messagesOf(withDay(6, { open: true, opensAt: '', closesAt: '15:00' }))).toEqual({
      'days.6.opensAt': 'Choose the opening time.',
    });
  });

  it('refuses an open day with no closing time with the server message', () => {
    expect(messagesOf(withDay(6, { open: true, opensAt: '10:00', closesAt: '' }))).toEqual({
      'days.6.closesAt': 'Choose the closing time.',
    });
  });

  it('refuses closing at or before opening with "Closing time must be after opening time."', () => {
    expect(messagesOf(withDay(0, { opensAt: '18:00', closesAt: '09:00' }))).toEqual({
      'days.0.closesAt': 'Closing time must be after opening time.',
    });
    expect(messagesOf(withDay(0, { opensAt: '09:00', closesAt: '09:00' }))).toEqual({
      'days.0.closesAt': 'Closing time must be after opening time.',
    });
  });

  it.each(['09:15', '04:30', '23:45', '24:00', '9:00', 'nine'])(
    'refuses %s, which is not on the half hour from 5:00 AM to 11:30 PM',
    (time) => {
      expect(messagesOf(withDay(1, { opensAt: time }))).toEqual({
        'days.1.opensAt': 'Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.',
      });
    },
  );

  it('does not look at the times of a closed day', () => {
    expect(messagesOf(withDay(2, { open: false, opensAt: '99:99', closesAt: '' }))).toEqual({});
  });

  it('reports every broken day at once', () => {
    const values = withDay(0, { opensAt: '18:00', closesAt: '09:00' });
    const both = { days: values.days.map((day, at) => (at === 3 ? { ...day, opensAt: '' } : day)) };

    expect(Object.keys(messagesOf(both)).sort()).toEqual(['days.0.closesAt', 'days.3.opensAt']);
  });
});

describe('the hours form values and request (plan 11-16)', () => {
  it('shows a closed day unticked with no times, and an open day ticked with its 24-hour times', () => {
    const values = hoursValuesOf(demoOpeningHours);

    expect(values.days[0]).toEqual({ day: 1, open: true, opensAt: '09:00', closesAt: '18:00' });
    expect(values.days[6]).toEqual({ day: 7, open: false, opensAt: '', closesAt: '' });
  });

  it('sends the seven days Monday first, a closed day with null times, and the version the form opened with', () => {
    const values = hoursValuesOf(demoOpeningHours);
    const ticked = {
      days: values.days.map((day) =>
        day.day === 7 ? { ...day, open: true, opensAt: '10:00', closesAt: '15:00' } : day,
      ),
    };

    const request = toOpeningHoursRequest(ticked, 'v1');

    expect(request.version).toBe('v1');
    expect(request.days).toHaveLength(7);
    expect(request.days?.[6]).toEqual({ day: 7, opensAt: '10:00', closesAt: '15:00' });
    expect(toOpeningHoursRequest(values, 'v1').days?.[6]).toEqual({ day: 7, opensAt: null, closesAt: null });
  });

  it('sends the times of a day that was unticked as null even when the form still holds them', () => {
    const values = hoursValuesOf(demoOpeningHours);
    const unticked = { days: values.days.map((day) => (day.day === 1 ? { ...day, open: false } : day)) };

    expect(toOpeningHoursRequest(unticked, 'v1').days?.[0]).toEqual({ day: 1, opensAt: null, closesAt: null });
  });

  it('gives a ticked day 9:00 AM to 6:00 PM when it has no times of its own', () => {
    expect(DEFAULT_OPENS).toBe('09:00');
    expect(DEFAULT_CLOSES).toBe('18:00');
  });

  it('reads the week back as the days the preview needs', () => {
    const days = weekOfValues(hoursValuesOf(demoOpeningHours));

    expect(days[0]).toEqual({ day: 1, opensAt: '09:00', closesAt: '18:00' });
    expect(days[6]).toEqual({ day: 7, opensAt: null, closesAt: null });
  });
});

// The closure form (OR-3; CONT-04; plan 11-16): it mirrors ShopClosureRequestValidator and ShopClosure.Check. The business today comes from the
// server; an edit keeps a first day that is already past (parked owner item OI-1, built as option A).
describe('closureSchema', () => {
  const TODAY = '2031-03-04';
  const GOOD: ClosureInput = { firstDay: '2031-03-10', lastDay: '', note: 'Christmas' };

  /** The messages of a closure form, keyed by the field they belong to. */
  function messagesOf(values: ClosureInput, today: string | null = TODAY, savedFirstDay: string | null = null) {
    const result = closureSchema(today, savedFirstDay).safeParse(values);
    if (result.success) {
      return {};
    }
    return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
  }

  it('takes a closure from today on, with or without a last day and a note', () => {
    expect(messagesOf(GOOD)).toEqual({});
    expect(messagesOf({ firstDay: TODAY, lastDay: '', note: '' })).toEqual({});
    expect(messagesOf({ firstDay: TODAY, lastDay: '2031-04-03', note: '' })).toEqual({});
  });

  it('needs a first day', () => {
    expect(messagesOf({ ...GOOD, firstDay: '' })).toEqual({ firstDay: 'Enter the first day.' });
    expect(messagesOf({ ...GOOD, firstDay: '   ' })).toEqual({ firstDay: 'Enter the first day.' });
  });

  it.each(['2031-02-30', '2031-13-01', '31/03/2031', 'soon'])(
    'refuses %s as a first day that is not a real date',
    (day) => {
      expect(messagesOf({ ...GOOD, firstDay: day })).toEqual({ firstDay: 'Enter a real date.' });
    },
  );

  it('refuses a first day before the business today with "Pick today or a later date."', () => {
    expect(messagesOf({ ...GOOD, firstDay: '2031-03-03' })).toEqual({ firstDay: 'Pick today or a later date.' });
  });

  it('does not check the first day against today while the business today is not known', () => {
    expect(messagesOf({ ...GOOD, firstDay: '2031-03-03' }, null)).toEqual({});
  });

  it('keeps an edit that leaves a past first day as it was, and refuses an edit that moves it to another past day', () => {
    expect(messagesOf({ ...GOOD, firstDay: '2031-03-01' }, TODAY, '2031-03-01')).toEqual({});
    expect(messagesOf({ ...GOOD, firstDay: '2031-03-02' }, TODAY, '2031-03-01')).toEqual({
      firstDay: 'Pick today or a later date.',
    });
  });

  it('refuses a last day that is not a real date', () => {
    expect(messagesOf({ ...GOOD, lastDay: '2031-02-30' })).toEqual({ lastDay: 'Enter a real date.' });
  });

  it('refuses a last day before the first day', () => {
    expect(messagesOf({ ...GOOD, lastDay: '2031-03-09' })).toEqual({
      lastDay: 'The last day must be on or after the first day.',
    });
  });

  it('allows 31 days and refuses 32 with "A closure can be up to 31 days. Add another one for longer."', () => {
    expect(messagesOf({ firstDay: '2031-03-04', lastDay: '2031-04-03', note: '' })).toEqual({});
    expect(messagesOf({ firstDay: '2031-03-04', lastDay: '2031-04-04', note: '' })).toEqual({
      lastDay: 'A closure can be up to 31 days. Add another one for longer.',
    });
  });

  it('counts the days across a leap day', () => {
    expect(messagesOf({ firstDay: '2032-02-01', lastDay: '2032-03-02', note: '' }, '2032-01-01')).toEqual({});
    expect(messagesOf({ firstDay: '2032-02-01', lastDay: '2032-03-03', note: '' }, '2032-01-01')).toEqual({
      lastDay: 'A closure can be up to 31 days. Add another one for longer.',
    });
  });

  it('allows a note of 80 characters after the trim and refuses 81', () => {
    expect(messagesOf({ ...GOOD, note: `  ${'a'.repeat(80)}  ` })).toEqual({});
    expect(messagesOf({ ...GOOD, note: 'a'.repeat(81) })).toEqual({
      note: 'Keep the note to 80 characters or fewer.',
    });
  });

  it('judges only what could be read: a bad first day makes no made-up second error', () => {
    expect(messagesOf({ firstDay: '2031-02-30', lastDay: '2031-01-01', note: '' })).toEqual({
      firstDay: 'Enter a real date.',
    });
  });
});

describe('the closure form values and request (plan 11-16)', () => {
  it('starts an add on the business today with no last day and no note', () => {
    expect(closureValuesOf(null, '2031-03-04')).toEqual({ firstDay: '2031-03-04', lastDay: '', note: '' });
    expect(closureValuesOf(null, null)).toEqual({ firstDay: '', lastDay: '', note: '' });
  });

  it('shows a saved closure with its days and note, a one day closure with no last day', () => {
    expect(closureValuesOf(demoClosures[0] ?? null, '2031-03-04')).toEqual({
      firstDay: '2026-12-25',
      lastDay: '',
      note: 'Christmas',
    });
    expect(closureValuesOf(demoClosures[1] ?? null, '2031-03-04')).toEqual({
      firstDay: '2026-12-30',
      lastDay: '2027-01-01',
      note: '',
    });
  });

  it('sends an add with no version, an empty last day and note as null, and the note trimmed', () => {
    expect(toClosureRequest({ firstDay: '2031-03-10', lastDay: '', note: '  Christmas  ' }, null)).toEqual({
      firstDay: '2031-03-10',
      lastDay: null,
      note: 'Christmas',
      version: null,
    });
    expect(toClosureRequest({ firstDay: '2031-03-10', lastDay: '', note: '   ' }, null).note).toBeNull();
  });

  it('sends an edit with the version the form was opened with', () => {
    expect(toClosureRequest({ firstDay: '2031-03-10', lastDay: '2031-03-12', note: '' }, 'v1')).toEqual({
      firstDay: '2031-03-10',
      lastDay: '2031-03-12',
      note: null,
      version: 'v1',
    });
  });
});

describe('the product line form values and request (CONT-02; plan 11-20)', () => {
  it('shows a saved line as text: the price with two decimals, the minimum as digits, no price as an empty box', () => {
    const basketball = productLineValuesOf(demoLineDetail('basketball'));
    expect(basketball).toMatchObject({
      isActive: true,
      title: 'Basketball Jerseys',
      shortName: 'Basketball',
      number: '23',
      startsAtPrice: '650.00',
      minimumQuantity: '10',
      productTypeIds: [LINE_TYPE_IDS.basketball],
    });
    expect(productLineValuesOf(demoLineDetail('polo'))).toMatchObject({ startsAtPrice: '', minimumQuantity: '' });
  });

  it('starts a new line unticked (hidden), with every text empty and no product type', () => {
    expect(productLineValuesOf(null)).toEqual({
      isActive: false,
      title: '',
      shortName: '',
      number: '',
      cardText: '',
      description: '',
      fabricText: '',
      collarText: '',
      cutText: '',
      namesText: '',
      logosText: '',
      startsAtPrice: '',
      minimumQuantity: '',
      productTypeIds: [],
    });
  });

  it('sends an edit with the version, the texts trimmed, the price and minimum as numbers and an empty one as null', () => {
    const values = {
      ...productLineValuesOf(demoLineDetail('polo')),
      title: '  Polo Shirts ',
      startsAtPrice: '450.00',
      minimumQuantity: '',
    };
    expect(toProductLineRequest(values, 'v1')).toMatchObject({
      version: 'v1',
      title: 'Polo Shirts',
      startsAtPrice: 450,
      minimumQuantity: null,
      isActive: true,
    });
  });

  it('sends an add with no version', () => {
    expect(toProductLineRequest(productLineValuesOf(null), null).version).toBeNull();
  });

  it('sends every product type id the form holds, retired ones the checklist does not show included', () => {
    const line = demoLineDetail('moto', { productTypeIds: [LINE_TYPE_IDS.old, LINE_TYPE_IDS.cycling] });
    expect(productLineValuesOf(line).productTypeIds).toEqual([LINE_TYPE_IDS.old, LINE_TYPE_IDS.cycling]);
    expect(toProductLineRequest(productLineValuesOf(line), 'v1').productTypeIds).toEqual([
      LINE_TYPE_IDS.old,
      LINE_TYPE_IDS.cycling,
    ]);
  });

  it('reads the price and minimum a visitor would see, and nothing from a value the rules refuse', () => {
    expect(readLinePrice('650.00')).toBe(650);
    expect(readLinePrice('')).toBeNull();
    expect(readLinePrice('0.00')).toBeNull();
    expect(readLinePrice('1000000.00')).toBeNull();
    expect(readLineMinimum('10')).toBe(10);
    expect(readLineMinimum('')).toBeNull();
    expect(readLineMinimum('0')).toBeNull();
    expect(readLineMinimum('10000')).toBeNull();
  });
});

describe('productLineSchema: every ProductLine.Check rule with the server message (OR-3, CONT-02; plan 11-20)', () => {
  const good = productLineValuesOf(demoLineDetail('basketball'));

  /** The first message per field for these values, by field name. */
  function messagesOf(overrides: Partial<ReturnType<typeof productLineValuesOf>>): Record<string, string> {
    const result = productLineSchema.safeParse({ ...good, ...overrides });
    const messages: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        messages[String(issue.path[0])] ??= issue.message;
      }
    }
    return messages;
  }

  it('accepts a saved line and a line with every text and no price, minimum or number', () => {
    expect(messagesOf({})).toEqual({});
    expect(messagesOf({ startsAtPrice: '', minimumQuantity: '', number: '' })).toEqual({});
  });

  it('title: required, and at most 60 characters counted after the trim', () => {
    expect(messagesOf({ title: '' }).title).toBe('Enter the title.');
    expect(messagesOf({ title: '   ' }).title).toBe('Enter the title.');
    expect(messagesOf({ title: 'a'.repeat(61) }).title).toBe('Keep the title to 60 characters or fewer.');
    expect(messagesOf({ title: 'a'.repeat(60) }).title).toBeUndefined();
    expect(messagesOf({ title: `  ${'a'.repeat(60)}  ` }).title).toBeUndefined();
  });

  it('short name: required, and at most 20 characters', () => {
    expect(messagesOf({ shortName: '' }).shortName).toBe('Enter a short name.');
    expect(messagesOf({ shortName: 'a'.repeat(21) }).shortName).toBe('Keep the short name to 20 characters or fewer.');
    expect(messagesOf({ shortName: 'a'.repeat(20) }).shortName).toBeUndefined();
  });

  it('number: optional, up to 2 ASCII letters or digits', () => {
    for (const number of ['', '3', '23', '3X', 'ab']) {
      expect(messagesOf({ number }).number, number).toBeUndefined();
    }
    for (const number of ['123', 'abc', '2 3', '#1', 'é1', '3.']) {
      expect(messagesOf({ number }).number, number).toBe('Use up to 2 letters or digits, like 23 or 3X.');
    }
  });

  it('card text and description: required, at most 140 and 300 characters', () => {
    expect(messagesOf({ cardText: '' }).cardText).toBe('Enter the card text.');
    expect(messagesOf({ cardText: 'a'.repeat(141) }).cardText).toBe('Keep the card text to 140 characters or fewer.');
    expect(messagesOf({ cardText: 'a'.repeat(140) }).cardText).toBeUndefined();
    expect(messagesOf({ description: '' }).description).toBe('Enter the description.');
    expect(messagesOf({ description: 'a'.repeat(301) }).description).toBe(
      'Keep the description to 300 characters or fewer.',
    );
    expect(messagesOf({ description: 'a'.repeat(300) }).description).toBeUndefined();
  });

  it('each customize text: required with its own card title in the message, at most 120 characters', () => {
    const labels = {
      fabricText: 'Fabric',
      collarText: 'Collar style',
      cutText: 'Cut & fit',
      namesText: 'Names & numbers',
      logosText: 'Logos & sponsors',
    } as const;
    for (const [field, label] of Object.entries(labels)) {
      expect(messagesOf({ [field]: '' })[field], field).toBe(`Enter the ${label} text.`);
      expect(messagesOf({ [field]: 'a'.repeat(121) })[field], field).toBe('Keep this to 120 characters or fewer.');
      expect(messagesOf({ [field]: 'a'.repeat(120) })[field], field).toBeUndefined();
    }
  });

  it('price: 0.01 and 999,999.99 pass; 0.00, 1,000,000.00 and three decimals fail, the decimals checked before the range', () => {
    for (const price of ['', '0.01', '1', '650.00', '999999.99', '999999']) {
      expect(messagesOf({ startsAtPrice: price }).startsAtPrice, price).toBeUndefined();
    }
    for (const price of ['0', '0.00', '0.0']) {
      expect(messagesOf({ startsAtPrice: price }).startsAtPrice, price).toBe('Enter a price of at least ₱0.01.');
    }
    for (const price of ['1000000.00', '1000000', '9999999.99']) {
      expect(messagesOf({ startsAtPrice: price }).startsAtPrice, price).toBe('Enter a price up to ₱999,999.99.');
    }
    for (const price of ['1.234', '0.001', '1000000.001']) {
      expect(messagesOf({ startsAtPrice: price }).startsAtPrice, price).toBe('Use at most 2 decimal places.');
    }
  });

  it('minimum: 1 and 9,999 pass; 0, 10,000, a fraction and a word fail', () => {
    for (const minimum of ['', '1', '10', '9999']) {
      expect(messagesOf({ minimumQuantity: minimum }).minimumQuantity, minimum).toBeUndefined();
    }
    for (const minimum of ['0', '10000', '1.5', 'abc', '-1', '1e3']) {
      expect(messagesOf({ minimumQuantity: minimum }).minimumQuantity, minimum).toBe(
        'Enter a whole number from 1 to 9,999.',
      );
    }
  });

  it('flags every required field of a new, empty line, and nothing else', () => {
    expect(Object.keys(messagesOf(productLineValuesOf(null))).sort()).toEqual([
      'cardText',
      'collarText',
      'cutText',
      'description',
      'fabricText',
      'logosText',
      'namesText',
      'shortName',
      'title',
    ]);
  });
});

describe('testimonialSchema: every Testimonial.Check rule with the server message (OR-3, CONT-03; plan 11-24)', () => {
  const [juan] = demoTestimonials();
  if (juan === undefined) {
    throw new Error('The demo testimonials are empty.');
  }
  const good = testimonialValuesOf(juan);

  /** The first message per field for these values, by field name. */
  function messagesOf(overrides: Partial<TestimonialInput>): Record<string, string> {
    const result = testimonialSchema.safeParse({ ...good, ...overrides });
    const messages: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        messages[String(issue.path[0])] ??= issue.message;
      }
    }
    return messages;
  }

  it('accepts a saved testimonial and one with no team or role', () => {
    expect(messagesOf({})).toEqual({});
    expect(messagesOf({ teamOrRole: '' })).toEqual({});
  });

  it('quote: required, and at most 300 characters counted after the trim', () => {
    expect(messagesOf({ quote: '' }).quote).toBe('Enter the quote.');
    expect(messagesOf({ quote: '   ' }).quote).toBe('Enter the quote.');
    expect(messagesOf({ quote: 'a'.repeat(301) }).quote).toBe('Keep the quote to 300 characters or fewer.');
    expect(messagesOf({ quote: 'a'.repeat(300) })).toEqual({});
    expect(messagesOf({ quote: `  ${'a'.repeat(300)}  ` })).toEqual({});
  });

  it('name: required, and at most 60 characters', () => {
    expect(messagesOf({ name: '' }).name).toBe('Enter the name.');
    expect(messagesOf({ name: 'a'.repeat(61) }).name).toBe('Keep the name to 60 characters or fewer.');
    expect(messagesOf({ name: 'a'.repeat(60) })).toEqual({});
  });

  it('team or role: optional, and at most 80 characters', () => {
    expect(messagesOf({ teamOrRole: 'a'.repeat(81) }).teamOrRole).toBe('Keep this to 80 characters or fewer.');
    expect(messagesOf({ teamOrRole: 'a'.repeat(80) })).toEqual({});
  });

  it('stars: a whole number from 1 to 5', () => {
    for (const stars of ['1', '2', '3', '4', '5']) {
      expect(messagesOf({ stars }), stars).toEqual({});
    }
    for (const stars of ['', '0', '6', '2.5', 'five', '-1']) {
      expect(messagesOf({ stars }).stars, stars).toBe('Choose 1 to 5 stars.');
    }
  });

  it('flags the quote and the name of a new, empty form, and nothing else', () => {
    expect(Object.keys(messagesOf(testimonialValuesOf(null))).sort()).toEqual(['name', 'quote']);
  });
});

describe('the testimonial form values and request (CONT-03; plan 11-24)', () => {
  const [juan] = demoTestimonials();
  if (juan === undefined) {
    throw new Error('The demo testimonials are empty.');
  }

  it('starts an add with 5 stars, shown, and every text empty', () => {
    expect(testimonialValuesOf(null)).toEqual({ quote: '', name: '', teamOrRole: '', stars: '5', isShown: true });
  });

  it('shows a saved testimonial as text, a missing team or role as an empty text', () => {
    expect(testimonialValuesOf(juan)).toEqual({
      quote: 'Seventeen pieces, names and numbers perfect.',
      name: 'Juan Dela Cruz',
      teamOrRole: 'Captain, Brgy. Sample Ballers',
      stars: '5',
      isShown: true,
    });
    const hidden = demoTestimonials()[3];
    expect(hidden && testimonialValuesOf(hidden)).toMatchObject({ teamOrRole: '', stars: '1', isShown: false });
  });

  it('sends the texts trimmed, the stars as a number, an empty team or role as null and the version of an edit', () => {
    expect(
      toTestimonialRequest(
        { quote: '  Great.  ', name: ' Ana ', teamOrRole: '   ', stars: '4', isShown: false },
        'AAAAAAAAG01=',
      ),
    ).toEqual({ quote: 'Great.', name: 'Ana', teamOrRole: null, stars: 4, isShown: false, version: 'AAAAAAAAG01=' });
    expect(
      toTestimonialRequest({ quote: 'Q', name: 'N', teamOrRole: ' Captain ', stars: '5', isShown: true }, null),
    ).toEqual({ quote: 'Q', name: 'N', teamOrRole: 'Captain', stars: 5, isShown: true, version: null });
  });

  it('keeps the words inside the quote exactly as typed', () => {
    const typed = 'Two  spaces,\nand a new line, “curly” quotes & <b>tags</b>.';

    expect(
      toTestimonialRequest({ quote: typed, name: 'N', teamOrRole: '', stars: '5', isShown: true }, null).quote,
    ).toBe(typed);
  });
});

describe('galleryUploadSchema: every GalleryUploadRequestValidator rule with the server message (OR-3, GAL-03; plan 11-32)', () => {
  const good: GalleryUploadInput = {
    hasPhoto: true,
    teamName: 'Sample Barangay Riders',
    productLineId: '8c1f4a20-0000-4000-8000-000000000003',
    pieces: '12',
    note: 'Dri-fit mesh, V-neck',
    isShown: true,
  };

  /** The first message per field for these values on the add form, by field name. */
  function messagesOf(overrides: Partial<GalleryUploadInput>, schema = galleryUploadSchema): Record<string, string> {
    const result = schema.safeParse({ ...good, ...overrides });
    const messages: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        messages[String(issue.path[0])] ??= issue.message;
      }
    }
    return messages;
  }

  it('accepts a full form and one with no pieces and no note', () => {
    expect(messagesOf({})).toEqual({});
    expect(messagesOf({ pieces: '', note: '' })).toEqual({});
  });

  it('photo: required on add, optional on edit', () => {
    expect(messagesOf({ hasPhoto: false }).hasPhoto).toBe('Choose a photo.');
    expect(messagesOf({ hasPhoto: false }, galleryEditSchema)).toEqual({});
  });

  it('team or name: required, and at most 80 characters counted after the trim', () => {
    expect(messagesOf({ teamName: '' }).teamName).toBe('Enter the team or name.');
    expect(messagesOf({ teamName: '   ' }).teamName).toBe('Enter the team or name.');
    expect(messagesOf({ teamName: 'a'.repeat(81) }).teamName).toBe('Keep this to 80 characters or fewer.');
    expect(messagesOf({ teamName: 'a'.repeat(80) })).toEqual({});
    expect(messagesOf({ teamName: `  ${'a'.repeat(80)}  ` })).toEqual({});
  });

  it('product line: required', () => {
    expect(messagesOf({ productLineId: '' }).productLineId).toBe('Choose the product line.');
  });

  it('pieces: empty, or a whole number from 1 to 9,999', () => {
    for (const bad of ['0', '10000', '-3', '2.5', '1,200', 'twelve', '12 pcs', '٣']) {
      expect(messagesOf({ pieces: bad }).pieces, bad).toBe('Enter a whole number from 1 to 9,999.');
    }
    for (const fine of ['1', '9999', ' 12 ', '007']) {
      expect(messagesOf({ pieces: fine }), fine).toEqual({});
    }
    expect(galleryPiecesError('')).toBeNull();
  });

  it('note: at most 120 characters counted after the trim', () => {
    expect(messagesOf({ note: 'a'.repeat(121) }).note).toBe('Keep the note to 120 characters or fewer.');
    expect(messagesOf({ note: 'a'.repeat(120) })).toEqual({});
    expect(messagesOf({ note: `  ${'a'.repeat(120)}  ` })).toEqual({});
  });

  it('a new form has no photo, empty texts, and Show on the website ticked', () => {
    expect(galleryUploadValuesOf(null)).toEqual({
      hasPhoto: false,
      teamName: '',
      productLineId: '',
      pieces: '',
      note: '',
      isShown: true,
    });
  });

  it('the form of a saved upload holds its words, its line and its pieces, with a photo', () => {
    const upload = demoGalleryItems()[0];

    expect(upload && galleryUploadValuesOf(upload)).toEqual({
      hasPhoto: true,
      teamName: 'Sample Barangay Riders',
      productLineId: '8c1f4a20-0000-4000-8000-000000000003',
      pieces: '12',
      note: 'Dri-fit mesh, V-neck',
      isShown: true,
    });
    const hidden = demoGalleryItems()[5];
    expect(hidden && galleryUploadValuesOf(hidden)).toMatchObject({ note: '', isShown: false });
  });

  it('sends the texts trimmed, the pieces as a number (null for none) and the version of an edit', () => {
    expect(
      toGalleryUploadRequest(
        { ...good, teamName: '  Riders  ', pieces: ' 12 ', note: ' Mesh ', isShown: false },
        'AAAAAAAAH01=',
      ),
    ).toEqual({
      teamName: 'Riders',
      productLineId: good.productLineId,
      pieces: 12,
      note: 'Mesh',
      isShown: false,
      version: 'AAAAAAAAH01=',
    });
    expect(toGalleryUploadRequest({ ...good, pieces: '', note: '   ' }, null)).toMatchObject({
      pieces: null,
      note: '',
      version: null,
    });
  });
});
