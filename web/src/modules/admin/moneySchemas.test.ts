import { describe, expect, it } from 'vitest';
import {
  handoverFormSchema,
  toHandoverBody,
  toTransferBody,
  transferFormSchema,
  type HandoverSchemaOptions,
  type TransferFormInput,
  type TransferSchemaOptions,
} from './moneySchemas';

// The Transfer Money form rules (OR-3, MONEY-04; plan 10-15): each rule gives the server's own words (MoneyRules.cs).

const TODAY = '2026-11-04';
const LIZA = '0b0f6c1e-0000-4000-8000-000000000002';

function form(overrides: Partial<TransferFormInput> = {}): TransferFormInput {
  return { toUserId: LIZA, amount: '2000.00', transferDate: TODAY, note: '', ...overrides };
}

/** The message under each field the schema refuses, by field. */
function messages(values: TransferFormInput, options: Partial<TransferSchemaOptions> = {}): Record<string, string> {
  const result = transferFormSchema({ balance: 8450, today: TODAY, ...options }).safeParse(values);
  const found: Record<string, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      found[String(issue.path[0])] ??= issue.message;
    }
  }
  return found;
}

describe('To', () => {
  it('needs someone chosen: "Choose who got the cash."', () => {
    expect(messages(form({ toUserId: '' }))).toEqual({ toUserId: 'Choose who got the cash.' });
  });
});

describe('Amount', () => {
  it('needs an amount: "Enter the amount."', () => {
    expect(messages(form({ amount: '' }))).toEqual({ amount: 'Enter the amount.' });
    expect(messages(form({ amount: '.' }))).toEqual({ amount: 'Enter the amount.' });
  });

  it('accepts 0.01 and refuses 0.00: "Enter an amount of at least ₱0.01."', () => {
    expect(messages(form({ amount: '0.01' }))).toEqual({});
    expect(messages(form({ amount: '0.00' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
    expect(messages(form({ amount: '0' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
  });

  it('says "at least" for an amount of zero however many decimals it has, as the server does (wave 7 IN-04)', () => {
    expect(messages(form({ amount: '0.000' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
    expect(messages(form({ amount: '0.0000' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
    expect(messages(form({ amount: '.000' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
    expect(messages(form({ amount: '0.001' }))).toEqual({ amount: 'Use at most 2 decimal places.' });
  });

  it('refuses a third decimal: "Use at most 2 decimal places."', () => {
    expect(messages(form({ amount: '10.005' }))).toEqual({ amount: 'Use at most 2 decimal places.' });
    expect(messages(form({ amount: '10.05' }))).toEqual({});
  });

  it('refuses text that is not money with the amount field words', () => {
    expect(messages(form({ amount: '12a' }))).toHaveProperty('amount');
  });

  it('refuses more than the balance read when the window opened: "You only have ₱3,200.00 on hand."', () => {
    expect(messages(form({ amount: '3200.01' }), { balance: 3200 })).toEqual({
      amount: 'You only have ₱3,200.00 on hand.',
    });
  });

  it('accepts exactly the balance, centavos included', () => {
    expect(messages(form({ amount: '3200.00' }), { balance: 3200 })).toEqual({});
    expect(messages(form({ amount: '1250.50' }), { balance: 1250.5 })).toEqual({});
  });

  it('says there is nothing to transfer when the balance is zero or below: "You have nothing on hand to transfer."', () => {
    expect(messages(form({ amount: '1.00' }), { balance: 0 })).toEqual({
      amount: 'You have nothing on hand to transfer.',
    });
    expect(messages(form({ amount: '1.00' }), { balance: -500 })).toEqual({
      amount: 'You have nothing on hand to transfer.',
    });
  });

  it('leaves the cap to the server while the balance is not known', () => {
    expect(messages(form({ amount: '99999.00' }), { balance: null })).toEqual({});
  });
});

describe('Date', () => {
  it('needs a date: "Enter the transfer date."', () => {
    expect(messages(form({ transferDate: '' }))).toEqual({ transferDate: 'Enter the transfer date.' });
    expect(messages(form({ transferDate: '   ' }))).toEqual({ transferDate: 'Enter the transfer date.' });
  });

  it('needs a real day: "Enter a real date."', () => {
    expect(messages(form({ transferDate: '2026-02-30' }))).toEqual({ transferDate: 'Enter a real date.' });
    expect(messages(form({ transferDate: 'yesterday' }))).toEqual({ transferDate: 'Enter a real date.' });
  });

  it('accepts the business today and refuses tomorrow: "The transfer date can\'t be in the future."', () => {
    expect(messages(form({ transferDate: TODAY }))).toEqual({});
    expect(messages(form({ transferDate: '2026-11-05' }))).toEqual({
      transferDate: "The transfer date can't be in the future.",
    });
  });

  it('counts from the business today it is given, not the device clock', () => {
    expect(messages(form({ transferDate: '2026-11-05' }), { today: '2026-11-05' })).toEqual({});
  });
});

describe('Note', () => {
  it('accepts 200 characters after trimming and refuses 201: "Keep the note to 200 characters or fewer."', () => {
    expect(messages(form({ note: 'a'.repeat(200) }))).toEqual({});
    expect(messages(form({ note: `  ${'a'.repeat(200)}  ` }))).toEqual({});
    expect(messages(form({ note: 'a'.repeat(201) }))).toEqual({ note: 'Keep the note to 200 characters or fewer.' });
  });

  it('measures the note without a byte-order mark (U+FEFF) or a next-line mark (U+0085) at either end, as the server does (IN-04)', () => {
    const body = 'a'.repeat(200);

    expect(messages(form({ note: `\uFEFF${body}` }))).toEqual({});
    expect(messages(form({ note: `\u0085${body}` }))).toEqual({});
    expect(messages(form({ note: `${body}\u0085\uFEFF` }))).toEqual({});
    expect(messages(form({ note: ` \uFEFF \u0085${body} \u0085 ` }))).toEqual({});
    expect(messages(form({ note: `\uFEFF${'a'.repeat(201)}` }))).toEqual({
      note: 'Keep the note to 200 characters or fewer.',
    });
  });

  it('sends the note without those marks at its ends, and keeps them inside the text', () => {
    const schema = transferFormSchema({ balance: 8450, today: TODAY });

    expect(schema.parse(form({ note: '\u0085\uFEFF Cash\u0085for fabric \u0085' })).note).toBe('Cash\u0085for fabric');
  });

  it('turns a note of only those marks and spaces into null', () => {
    const schema = transferFormSchema({ balance: 8450, today: TODAY });

    expect(schema.parse(form({ note: ' \uFEFF\u0085 ' })).note).toBeNull();
  });

  it('turns a note of spaces into null', () => {
    const result = transferFormSchema({ balance: 8450, today: TODAY }).parse(form({ note: '    ' }));

    expect(result.note).toBeNull();
  });
});

describe('a Manager sending to a leaver who is owed money (D-49, OR-3; plan 10-19)', () => {
  const ANA = '0b0f6c1e-0000-4000-8000-000000000005';
  const owed = new Map([[ANA, { name: 'Ana Villanueva', owed: 300 }]]);

  it('refuses more than the leaver is owed, with the name and the figure: "{name} is owed only ₱300.00. Enter that or less."', () => {
    expect(messages(form({ toUserId: ANA, amount: '300.01' }), { owedByRecipient: owed })).toEqual({
      amount: 'Ana Villanueva is owed only ₱300.00. Enter that or less.',
    });
  });

  it('accepts exactly what is owed, centavos included', () => {
    expect(messages(form({ toUserId: ANA, amount: '300.00' }), { owedByRecipient: owed })).toEqual({});
    const cents = new Map([[ANA, { name: 'Ana Villanueva', owed: 12.34 }]]);
    expect(messages(form({ toUserId: ANA, amount: '12.34' }), { owedByRecipient: cents })).toEqual({});
    expect(messages(form({ toUserId: ANA, amount: '12.35' }), { owedByRecipient: cents })).toEqual({
      amount: 'Ana Villanueva is owed only ₱12.34. Enter that or less.',
    });
  });

  it('leaves another recipient, and a leaver the browser has no figure for, to the server', () => {
    expect(messages(form({ toUserId: LIZA, amount: '5000.00' }), { owedByRecipient: owed })).toEqual({});
    expect(messages(form({ toUserId: ANA, amount: '5000.00' }), { owedByRecipient: new Map() })).toEqual({});
    expect(messages(form({ toUserId: ANA, amount: '5000.00' }))).toEqual({});
  });

  it('checks the sender balance first: "You only have ₱100.00 on hand."', () => {
    expect(messages(form({ toUserId: ANA, amount: '150.00' }), { balance: 100, owedByRecipient: owed })).toEqual({
      amount: 'You only have ₱100.00 on hand.',
    });
  });

  it('keeps the other amount words when the amount is not a usable figure', () => {
    expect(messages(form({ toUserId: ANA, amount: '0.00' }), { owedByRecipient: owed })).toEqual({
      amount: 'Enter an amount of at least ₱0.01.',
    });
    expect(messages(form({ toUserId: ANA, amount: '' }), { owedByRecipient: owed })).toEqual({
      amount: 'Enter the amount.',
    });
  });

  it('still shows the cap when another field also has an error', () => {
    expect(
      messages(form({ toUserId: ANA, amount: '300.01', note: 'a'.repeat(201) }), { owedByRecipient: owed }),
    ).toEqual({
      amount: 'Ana Villanueva is owed only ₱300.00. Enter that or less.',
      note: 'Keep the note to 200 characters or fewer.',
    });
  });
});

describe('handoverFormSchema (D-17, D-18, OR-3; plan 10-19)', () => {
  const OPTIONS = { leaverName: 'Jomar Santos', leaverBalance: 2000, today: TODAY };

  function handoverMessages(
    values: TransferFormInput,
    options: Partial<HandoverSchemaOptions> = {},
  ): Record<string, string> {
    const result = handoverFormSchema({ ...OPTIONS, ...options }).safeParse(values);
    const found: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        found[String(issue.path[0])] ??= issue.message;
      }
    }
    return found;
  }

  it('needs a receiver chosen: "Choose who got the cash."', () => {
    expect(handoverMessages(form({ toUserId: '' }))).toEqual({ toUserId: 'Choose who got the cash.' });
  });

  it('caps the amount at what the leaver holds: "{name} only has ₱2,000.00 on hand."', () => {
    expect(handoverMessages(form({ amount: '2000.01' }))).toEqual({
      amount: 'Jomar Santos only has ₱2,000.00 on hand.',
    });
  });

  it('accepts exactly what the leaver holds, centavos included', () => {
    expect(handoverMessages(form({ amount: '2000.00' }))).toEqual({});
    expect(handoverMessages(form({ amount: '1250.50' }), { leaverBalance: 1250.5 })).toEqual({});
  });

  it('says there is nothing to hand over when the leaver holds zero or less: "{name} has nothing on hand to hand over."', () => {
    expect(handoverMessages(form({ amount: '1.00' }), { leaverBalance: 0 })).toEqual({
      amount: 'Jomar Santos has nothing on hand to hand over.',
    });
    expect(handoverMessages(form({ amount: '1.00' }), { leaverBalance: -300 })).toEqual({
      amount: 'Jomar Santos has nothing on hand to hand over.',
    });
  });

  it('leaves the cap to the server while the leaver balance is not known', () => {
    expect(handoverMessages(form({ amount: '99999.00' }), { leaverBalance: null })).toEqual({});
  });

  it('measures the hand-over note with the same combined strip, including a mixed edge (IN-04)', () => {
    const body = 'a'.repeat(200);

    expect(handoverMessages(form({ note: ` \uFEFF \u0085${body}\u0085 \uFEFF ` }))).toEqual({});
    expect(handoverMessages(form({ note: ` \uFEFF \u0085${body}a` }))).toEqual({
      note: 'Keep the note to 200 characters or fewer.',
    });
  });

  it('uses the Amount, Date and Note words of the transfer form', () => {
    expect(handoverMessages(form({ amount: '' }))).toEqual({ amount: 'Enter the amount.' });
    expect(handoverMessages(form({ amount: '0.00' }))).toEqual({ amount: 'Enter an amount of at least ₱0.01.' });
    expect(handoverMessages(form({ amount: '10.005' }))).toEqual({ amount: 'Use at most 2 decimal places.' });
    expect(handoverMessages(form({ transferDate: '2026-11-05' }))).toEqual({
      transferDate: "The transfer date can't be in the future.",
    });
    expect(handoverMessages(form({ note: 'a'.repeat(201) }))).toEqual({
      note: 'Keep the note to 200 characters or fewer.',
    });
  });

  it('builds the body with the leaver as the sender, the amount with two decimals and the note as text or null', () => {
    const output = handoverFormSchema(OPTIONS).parse(form({ amount: '2000', note: ' Final settlement ' }));

    expect(toHandoverBody(output, 'leaver-id')).toEqual({
      fromUserId: 'leaver-id',
      toUserId: LIZA,
      amount: '2000.00',
      transferDate: TODAY,
      note: 'Final settlement',
    });
    expect(toHandoverBody(handoverFormSchema(OPTIONS).parse(form()), 'leaver-id').note).toBeNull();
  });
});

describe('toTransferBody', () => {
  it('sends the recipient, the amount as money text with two decimals, the day and the note, and nothing else', () => {
    const output = transferFormSchema({ balance: 8450, today: TODAY }).parse(
      form({ amount: '2000', transferDate: ` ${TODAY} `, note: ' Cash for the fabric run ' }),
    );

    expect(toTransferBody(output)).toEqual({
      toUserId: LIZA,
      amount: '2000.00',
      transferDate: TODAY,
      note: 'Cash for the fabric run',
    });
  });

  it('keeps an empty note as null', () => {
    const output = transferFormSchema({ balance: 8450, today: TODAY }).parse(form());

    expect(toTransferBody(output).note).toBeNull();
    expect(Object.keys(toTransferBody(output)).sort()).toEqual(['amount', 'note', 'toUserId', 'transferDate']);
  });
});
