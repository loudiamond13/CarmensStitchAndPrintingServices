// @vitest-environment node
/// <reference types="node" />
// The quote form's schema (OR-3, INQ-01): every case of the server validator (CreateQuoteRequestRequestValidatorTests, plan 13-01)
// gives the same message here, at the same edge. A mobile from the shared phone cases passes and a landline fails.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPlainEmail } from '@/utils/email';
import {
  newUploadKey,
  QUOTE_QUANTITIES,
  quoteFormSchema,
  toCreateQuoteRequest,
  type QuoteFormValues,
} from './quoteSchemas';

interface PhoneCases {
  accept: { input: string; e164: string }[];
  refuse: string[];
}

const phoneCases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/philippine-phone-cases.json', import.meta.url), 'utf8'),
) as PhoneCases;

interface EmailCases {
  quoteEmail: { accept: string[]; refuse: string[]; browserOnlyRefuse: string[] };
}

const emailCases = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/email-cases.json', import.meta.url), 'utf8'),
) as EmailCases;

function valid(overrides: Partial<QuoteFormValues> = {}): QuoteFormValues {
  return {
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 123 4567',
    email: 'juan.dc@example.com',
    product: 'line:basketball',
    quantity: '10-20',
    message: 'Need 15 jerseys by Dec 12.',
    subjectLine: '',
    ...overrides,
  };
}

const EMPTY: QuoteFormValues = {
  customerName: '',
  teamName: '',
  contactNumber: '',
  email: '',
  product: '',
  quantity: '',
  message: '',
  subjectLine: '',
};

/** The first message of each field that failed, as the form shows it. */
function fields(values: QuoteFormValues): Record<string, string> {
  const result = quoteFormSchema.safeParse(values);
  if (result.success) {
    return {};
  }
  const messages: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    messages[field] ??= issue.message;
  }
  return messages;
}

function one(values: QuoteFormValues, field: string, message: string): void {
  expect(fields(values)).toEqual({ [field]: message });
}

describe('quoteFormSchema: required fields', () => {
  it('accepts a boundary-valid form and a form with only a name and a number', () => {
    expect(fields(valid())).toEqual({});
    expect(fields({ ...EMPTY, customerName: 'Juan', contactNumber: '0917 123 4567' })).toEqual({});
  });

  it('lists the two required fields for an empty form', () => {
    expect(Object.keys(fields(EMPTY)).toSorted()).toEqual(['contactNumber', 'customerName']);
  });

  it.each(['', '   '])('refuses the name %j', (name) => {
    one(valid({ customerName: name }), 'customerName', 'Enter your name.');
  });

  it('limits a name to 100 UTF-16 units after trimming, an emoji counting as 2', () => {
    expect(fields(valid({ customerName: `  ${'a'.repeat(100)}  ` }))).toEqual({});
    one(valid({ customerName: 'a'.repeat(101) }), 'customerName', 'Keep your name to 100 characters or fewer.');
    one(
      valid({ customerName: `${'a'.repeat(99)}\u{1F600}` }),
      'customerName',
      'Keep your name to 100 characters or fewer.',
    );
  });

  it('limits a team name to 100 characters', () => {
    expect(fields(valid({ teamName: 't'.repeat(100) }))).toEqual({});
    one(valid({ teamName: 't'.repeat(101) }), 'teamName', 'Keep the team name to 100 characters or fewer.');
  });
});

describe('quoteFormSchema: the mobile number', () => {
  const MESSAGE = 'Enter a mobile number, like 0917 123 4567.';

  it.each(['', '   ', '02 8123 4567', '0917 123 456', 'banana'])('refuses %j', (number) => {
    one(valid({ contactNumber: number }), 'contactNumber', MESSAGE);
  });

  it.each(['0917.123.4567', '+63 917 123 4567', '(0917) 123-4567'])('accepts %j', (number) => {
    expect(fields(valid({ contactNumber: number }))).toEqual({});
  });

  it('counts the typed text, so 30 characters pass and 31 do not (IN-03)', () => {
    expect(fields(valid({ contactNumber: `0917${'-'.repeat(19)}1234567` }))).toEqual({});
    one(valid({ contactNumber: `0917${'-'.repeat(20)}1234567` }), 'contactNumber', MESSAGE);
  });

  it('counts the length after trimming, so spaces around a 30 character number do not count', () => {
    expect(fields(valid({ contactNumber: `  0917${'-'.repeat(19)}1234567  ` }))).toEqual({});
  });

  it.each(phoneCases.accept.filter((accepted) => accepted.e164.startsWith('+639')))(
    'accepts the shared mobile case $input',
    ({ input }) => {
      expect(fields(valid({ contactNumber: input.trim() }))).toEqual({});
    },
  );

  it.each(phoneCases.accept.filter((accepted) => !accepted.e164.startsWith('+639')))(
    'refuses the shared landline case $input (the quote form takes mobiles only)',
    ({ input }) => {
      one(valid({ contactNumber: input }), 'contactNumber', MESSAGE);
    },
  );

  it.each(phoneCases.refuse.filter((text) => text.trim() !== '' && text.length <= 30))(
    'refuses the shared refused case %j',
    (input) => {
      one(valid({ contactNumber: input }), 'contactNumber', MESSAGE);
    },
  );
});

describe('quoteFormSchema: the email', () => {
  it.each(['', '   '])('accepts an empty email %j', (email) => {
    expect(fields(valid({ email }))).toEqual({});
  });

  it.each(['nope', 'juan@', 'juan@example', 'Juan <juan@example.com>'])('refuses %j', (email) => {
    one(valid({ email }), 'email', 'Enter a valid email, like name@gmail.com');
  });

  it.each(['a<b@c.com', 'a(b)@c.com', 'a,b@c.com', 'a;b@c.com', 'a:b@c.com', 'a"b@c.com', 'a[b]@c.com', 'a\b@c.com'])(
    'refuses %j, a character the server refuses',
    (email) => {
      one(valid({ email }), 'email', 'Enter a valid email, like name@gmail.com');
    },
  );

  it('limits the email to 254 characters, and says the length first', () => {
    const domain = `${'b'.repeat(60)}.`.repeat(4) + 'com';
    expect(fields(valid({ email: `${'x'.repeat(6)}@${domain}` }))).toEqual({});
    one(valid({ email: `${'x'.repeat(7)}@${domain}` }), 'email', 'Keep the email to 254 characters or fewer.');
    one(valid({ email: 'x'.repeat(300) }), 'email', 'Keep the email to 254 characters or fewer.');
  });
});

describe('the shared quote email cases (tests/fixtures/email-cases.json)', () => {
  const { accept, refuse, browserOnlyRefuse } = emailCases.quoteEmail;
  const typed = (text: string) => text.trim() === text && text !== '';

  it.each(accept)('accepts %j, as the server does', (email) => {
    expect(isPlainEmail(email)).toBe(true);
  });

  it.each(refuse)('refuses %j, as the server does', (email) => {
    expect(isPlainEmail(email)).toBe(false);
  });

  it.each(browserOnlyRefuse)('refuses %j, which the server allows (the browser is stricter on purpose)', (email) => {
    expect(isPlainEmail(email)).toBe(false);
  });

  it('gives the form the same answer as the rule for every case', () => {
    for (const email of accept.filter(typed)) {
      expect(fields(valid({ email }))).toEqual({});
    }
    for (const email of [...refuse, ...browserOnlyRefuse].filter(typed)) {
      one(valid({ email }), 'email', 'Enter a valid email, like name@gmail.com');
    }
  });
});

describe('quoteFormSchema: product, quantity and message', () => {
  it.each(['', 'custom', 'not-sure', 'line:basketball', 'line:long-sleeves'])('accepts the product %j', (product) => {
    expect(fields(valid({ product }))).toEqual({});
  });

  it.each(['banana', 'LINE', 'line:', 'line:Bad Key', 'line:-a', `line:${'k'.repeat(41)}`])(
    'refuses the product %j',
    (product) => {
      one(valid({ product }), 'product', 'Choose a product from the list.');
    },
  );

  it('accepts a line key of 40 characters', () => {
    expect(fields(valid({ product: `line:${'k'.repeat(40)}` }))).toEqual({});
  });

  it.each(['', '1-9', '10-20', '21-50', '51-100', '100+'])('accepts the quantity %j', (quantity) => {
    expect(fields(valid({ quantity }))).toEqual({});
  });

  it.each(['7-8', 'many', '0'])('refuses the quantity %j', (quantity) => {
    one(valid({ quantity }), 'quantity', 'Choose a quantity from the list.');
  });

  it('offers the five ranges as pieces, the way the form lists them', () => {
    expect(QUOTE_QUANTITIES).toEqual([
      { value: '1-9', label: '1-9 pcs' },
      { value: '10-20', label: '10-20 pcs' },
      { value: '21-50', label: '21-50 pcs' },
      { value: '51-100', label: '51-100 pcs' },
      { value: '100+', label: '100+ pcs' },
    ]);
  });

  it('limits a message to 2,000 UTF-16 units, an emoji counting as 2', () => {
    expect(fields(valid({ message: 'm'.repeat(2000) }))).toEqual({});
    one(valid({ message: 'm'.repeat(2001) }), 'message', 'Keep your message to 2,000 characters or fewer.');
    one(
      valid({ message: `${'m'.repeat(1999)}\u{1F600}` }),
      'message',
      'Keep your message to 2,000 characters or fewer.',
    );
  });

  it('reads the honeypot as typed and never refuses it', () => {
    expect(fields(valid({ subjectLine: 'anything' }))).toEqual({});
  });
});

describe('quoteFormSchema: trimming', () => {
  it('hands on trimmed text', () => {
    const result = quoteFormSchema.safeParse(
      valid({
        customerName: '  Juan  ',
        teamName: ' Ballers ',
        contactNumber: ' 0917 123 4567 ',
        email: ' a@b.co ',
        message: ' hi ',
      }),
    );
    expect(result.success && result.data).toMatchObject({
      customerName: 'Juan',
      teamName: 'Ballers',
      contactNumber: '0917 123 4567',
      email: 'a@b.co',
      message: 'hi',
    });
  });
});

describe('toCreateQuoteRequest', () => {
  it('maps a line choice to productChoice "line" and its key', () => {
    expect(toCreateQuoteRequest(valid({ product: 'line:basketball' }))).toEqual({
      customerName: 'Juan Dela Cruz',
      teamName: 'Brgy. San Roque Ballers',
      contactNumber: '0917 123 4567',
      email: 'juan.dc@example.com',
      productChoice: 'line',
      productLineKey: 'basketball',
      quantity: '10-20',
      message: 'Need 15 jerseys by Dec 12.',
      subjectLine: '',
    });
  });

  it.each([
    ['custom', 'custom'],
    ['not-sure', 'not-sure'],
  ])('maps %s to its choice with no line key', (product, choice) => {
    const body = toCreateQuoteRequest(valid({ product }));
    expect(body.productChoice).toBe(choice);
    expect(body.productLineKey).toBe('');
  });

  it('sends optional fields left empty as empty text', () => {
    expect(toCreateQuoteRequest({ ...EMPTY, customerName: 'Juan', contactNumber: '0917 123 4567' })).toEqual({
      customerName: 'Juan',
      teamName: '',
      contactNumber: '0917 123 4567',
      email: '',
      productChoice: '',
      productLineKey: '',
      quantity: '',
      message: '',
      subjectLine: '',
    });
  });

  it('hands the honeypot on as typed', () => {
    expect(toCreateQuoteRequest(valid({ subjectLine: 'bot text' })).subjectLine).toBe('bot text');
  });
});

describe('newUploadKey (INQ-02, T-13-36)', () => {
  it('is 32 random bytes as 43 base64url characters with no padding', () => {
    for (let run = 0; run < 50; run++) {
      expect(newUploadKey()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('makes a different key every time', () => {
    const keys = new Set(Array.from({ length: 20 }, () => newUploadKey()));

    expect(keys.size).toBe(20);
  });

  it('turns the bytes of the browser random source into text and uses nothing else', () => {
    const spy = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        (array as unknown as Uint8Array).fill(0xfb);
        return array;
      });

    const key = newUploadKey();

    expect(spy).toHaveBeenCalledOnce();
    expect(key).toBe(Buffer.alloc(32, 0xfb).toString('base64url'));
    spy.mockRestore();
  });
});
