import { describe, expect, it } from 'vitest';
import { toTransferBody, transferFormSchema, type TransferFormInput, type TransferSchemaOptions } from './moneySchemas';

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

  it('turns a note of spaces into null', () => {
    const result = transferFormSchema({ balance: 8450, today: TODAY }).parse(form({ note: '    ' }));

    expect(result.note).toBeNull();
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
