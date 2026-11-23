import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_CODES,
  AUDIT_DETAIL_SENTENCES,
  AUDIT_GROUPS,
  auditActionGroup,
  auditActionLabel,
  describeAuditChange,
  describeAuditDetail,
  describeAuditOrderSnapshot,
  describeAuditSnapshot,
  isStatedValueAction,
} from './auditCopy';

// The audit viewer's words (AUDIT-02, D-28, D-40): a label and a group for every action the API can send, and the
// "What changed" text built only from the fixed words the log stores.

/** AuditActions.All in the backend (Csps.Domain.Auditing), in its order. */
const API_ACTIONS = [
  'auth.sign-in-failed',
  'auth.lockout',
  'auth.2fa-issued',
  'auth.2fa-resent',
  'auth.2fa-verified',
  'auth.2fa-failed',
  'auth.2fa-exhausted',
  'auth.signed-in',
  'auth.refresh-reuse-detected',
  'auth.signed-out',
  'auth.sessions-revoked',
  'auth.session-revoked',
  'auth.password-reset-requested',
  'auth.password-reset-completed',
  'auth.password-reset-link-invalid',
  'auth.password-changed',
  'auth.password-breach-found',
  'auth.breach-check-unavailable',
  'auth.invite-accepted',
  'user.bootstrap-manager-created',
  'user.invited',
  'user.created-temporary',
  'user.deactivated',
  'user.activated',
  'user.locked',
  'user.unlocked',
  'user.deleted',
  'user.details-changed',
  'user.role-changed',
  'user.email-change-started',
  'user.invitation-resent',
  'user.reset-link-sent',
  'user.temporary-password-set',
  'profile.name-changed',
  'profile.email-change-requested',
  'profile.email-changed',
  'profile.email-change-canceled',
  'company-expense.added',
  'company-expense.changed',
  'company-expense.payer-changed',
  'company-expense.deleted',
  'company-expense.restored',
  'company-expense.permanently-deleted',
  'expense-category.added',
  'expense-category.renamed',
  'expense-category.recolored',
  'expense-category.retired',
  'expense-category.reactivated',
  'expense-category.deleted',
  'order.created',
  'order.changed',
  'order.status-changed',
  'order.reopened',
  'order.deleted',
  'order.restored',
  'order.permanently-deleted',
  'order-item.added',
  'order-item.changed',
  'order-item.removed',
  'order-payment.added',
  'order-payment.changed',
  'order-payment.receiver-changed',
  'order-payment.removed',
  'order-refund.added',
  'order-refund.changed',
  'order-refund.refunder-changed',
  'order-refund.removed',
  'order-discount.added',
  'order-discount.changed',
  'order-discount.removed',
  'order-expense.added',
  'order-expense.changed',
  'order-expense.payer-changed',
  'order-expense.removed',
  'product-type.added',
  'product-type.renamed',
  'product-type.recolored',
  'product-type.retired',
  'product-type.reactivated',
  'product-type.deleted',
  'payment-method.added',
  'payment-method.renamed',
  'payment-method.recolored',
  'payment-method.retired',
  'payment-method.reactivated',
  'payment-method.deleted',
  'order-expense-category.added',
  'order-expense-category.renamed',
  'order-expense-category.recolored',
  'order-expense-category.retired',
  'order-expense-category.reactivated',
  'order-expense-category.deleted',
  'order-image.added',
  'order-image.moved',
  'order-image.cover-changed',
  'order-image.description-changed',
  'order-image.deleted',
  'money-transfer.added',
  'money-transfer.deleted',
  'money-transfer.permanently-deleted',
  'money-transfer.handed-over',
  'site-settings.changed',
  'opening-hours.changed',
  'shop-closure.added',
  'shop-closure.changed',
  'shop-closure.deleted',
  'product-line.added',
  'product-line.changed',
  'product-line.moved',
  'product-line.hidden',
  'product-line.shown',
  'product-line.deleted',
  'product-type.line-linked',
  'product-line.photo-changed',
  'testimonial.added',
  'testimonial.changed',
  'testimonial.moved',
  'testimonial.hidden',
  'testimonial.shown',
  'testimonial.deleted',
  'order.public-consent-recorded',
  'order.public-consent-removed',
  'order.shown-on-website',
  'order.taken-off-website',
  'order.public-details-changed',
  'gallery-photo.added',
  'gallery-photo.changed',
  'gallery-photo.hidden',
  'gallery-photo.shown',
  'gallery-photo.deleted',
  'gallery-item.moved',
  'site-settings.share-picture-changed',
  'quote-alerts.test-sent',
  'quote-request.status-changed',
] as const;

describe('the action labels (D-28)', () => {
  it('has a label and a group for every code the API can send, and no other', () => {
    expect([...AUDIT_ACTION_CODES].sort()).toEqual([...API_ACTIONS].sort());
    for (const code of API_ACTIONS) {
      const entry = AUDIT_ACTIONS.find((action) => action.code === code);
      expect(entry?.label, code).toBeTruthy();
      expect(AUDIT_GROUPS, code).toContain(entry?.group);
    }
  });

  it('uses the UI-SPEC labels', () => {
    expect(auditActionLabel('auth.signed-in')).toBe('Signed in');
    expect(auditActionLabel('auth.lockout')).toBe('Sign-in paused after too many tries');
    expect(auditActionLabel('user.deactivated')).toBe('User deactivated');
    expect(auditActionLabel('user.created-temporary')).toBe('User created with a temporary password');
    expect(auditActionLabel('user.invitation-resent')).toBe('Invitation sent again');
    expect(auditActionLabel('profile.email-changed')).toBe('Email changed');
    expect(auditActionLabel('profile.email-change-canceled')).toBe('Email change canceled');
  });

  it('mirrors every code of the API', () => {
    expect(API_ACTIONS).toHaveLength(134);
    expect(AUDIT_ACTION_CODES).toHaveLength(134);
  });

  it('reads a quote request status change under Orders (D-15)', () => {
    expect(auditActionLabel('quote-request.status-changed')).toBe('Quote request status changed');
    expect(auditActionGroup('quote-request.status-changed')).toBe('Orders');
  });

  it('reads the Quote alerts test email under Site content (D-11)', () => {
    expect(auditActionLabel('quote-alerts.test-sent')).toBe('Quote alerts test email sent');
    expect(auditActionGroup('quote-alerts.test-sent')).toBe('Site content');
  });

  it('reads the four money events in plain words under Staff money (AUDIT-01, MONEY-06; plan 10-20)', () => {
    const expected: [string, string][] = [
      ['money-transfer.added', 'Money transfer added'],
      ['money-transfer.deleted', 'Money transfer deleted'],
      ['money-transfer.permanently-deleted', 'Money transfer removed permanently'],
      ['money-transfer.handed-over', 'Money handed over'],
    ];
    for (const [code, label] of expected) {
      expect(auditActionLabel(code), code).toBe(label);
      expect(auditActionGroup(code), code).toBe('Staff money');
    }
  });

  it('reads the five order photo events in plain words under Orders (D-19)', () => {
    const expected: [string, string][] = [
      ['order-image.added', 'Order photo added'],
      ['order-image.moved', 'Order photo moved'],
      ['order-image.cover-changed', 'Order cover photo changed'],
      ['order-image.description-changed', 'Order photo description changed'],
      ['order-image.deleted', 'Order photo deleted'],
    ];
    for (const [code, label] of expected) {
      expect(auditActionLabel(code), code).toBe(label);
      expect(auditActionGroup(code), code).toBe('Orders');
    }
  });

  it('names the nine groups: the five from the UI-SPEC, the two order groups, Staff money and Site content', () => {
    expect(AUDIT_GROUPS).toEqual([
      'Sign-in and security',
      'Staff accounts',
      'Profile changes',
      'Company expenses',
      'Expense categories',
      'Orders',
      'Order lists',
      'Staff money',
      'Site content',
    ]);
  });

  it('reads the 31 Phase 11 events in the UI-SPEC words, under Site content or Orders (AUDIT-02)', () => {
    const siteContent: [string, string][] = [
      ['site-settings.changed', 'Site settings changed'],
      ['site-settings.share-picture-changed', 'Link preview picture changed'],
      ['opening-hours.changed', 'Opening hours changed'],
      ['shop-closure.added', 'Closure added'],
      ['shop-closure.changed', 'Closure changed'],
      ['shop-closure.deleted', 'Closure deleted'],
      ['product-line.added', 'Product line added'],
      ['product-line.changed', 'Product line changed'],
      ['product-line.moved', 'Product line moved'],
      ['product-line.hidden', 'Product line hidden'],
      ['product-line.shown', 'Product line shown'],
      ['product-line.deleted', 'Product line deleted'],
      ['product-line.photo-changed', 'Product line photo changed'],
      ['product-type.line-linked', 'Order product type linked to a product line'],
      ['testimonial.added', 'Testimonial added'],
      ['testimonial.changed', 'Testimonial changed'],
      ['testimonial.moved', 'Testimonial moved'],
      ['testimonial.hidden', 'Testimonial hidden'],
      ['testimonial.shown', 'Testimonial shown'],
      ['testimonial.deleted', 'Testimonial deleted'],
      ['gallery-photo.added', 'Gallery photo added'],
      ['gallery-photo.changed', 'Gallery photo changed'],
      ['gallery-item.moved', 'Gallery item moved'],
      ['gallery-photo.hidden', 'Gallery photo hidden'],
      ['gallery-photo.shown', 'Gallery photo shown'],
      ['gallery-photo.deleted', 'Gallery photo deleted'],
    ];
    const orders: [string, string][] = [
      ['order.public-consent-recorded', 'Customer OK to show recorded'],
      ['order.public-consent-removed', 'Customer OK to show removed'],
      ['order.shown-on-website', 'Order shown on the website'],
      ['order.taken-off-website', 'Order taken off the website'],
      ['order.public-details-changed', 'Order public details changed'],
    ];
    for (const [code, label] of siteContent) {
      expect(auditActionLabel(code), code).toBe(label);
      expect(auditActionGroup(code), code).toBe('Site content');
    }
    for (const [code, label] of orders) {
      expect(auditActionLabel(code), code).toBe(label);
      expect(auditActionGroup(code), code).toBe('Orders');
    }
    expect(siteContent).toHaveLength(26);
    expect(orders).toHaveLength(5);
  });

  it('reads the order and list events in plain words', () => {
    expect(auditActionLabel('order.created')).toBe('Order created');
    expect(auditActionLabel('order.reopened')).toBe('Order reopened');
    expect(auditActionLabel('order-payment.receiver-changed')).toBe('Order payment receiver changed');
    expect(auditActionLabel('order-refund.added')).toBe('Order refund added');
    expect(auditActionLabel('product-type.retired')).toBe('Product type retired');
  });

  it('names the order in all 14 order sub-entry labels (D-82)', () => {
    const expected: [string, string][] = [
      ['order-item.added', 'Order item added'],
      ['order-item.changed', 'Order item changed'],
      ['order-item.removed', 'Order item removed'],
      ['order-payment.added', 'Order payment added'],
      ['order-payment.changed', 'Order payment changed'],
      ['order-payment.receiver-changed', 'Order payment receiver changed'],
      ['order-payment.removed', 'Order payment removed'],
      ['order-refund.added', 'Order refund added'],
      ['order-refund.changed', 'Order refund changed'],
      ['order-refund.refunder-changed', 'Order refunder changed'],
      ['order-refund.removed', 'Order refund removed'],
      ['order-discount.added', 'Order discount added'],
      ['order-discount.changed', 'Order discount changed'],
      ['order-discount.removed', 'Order discount removed'],
    ];
    for (const [code, label] of expected) {
      expect(auditActionLabel(code), code).toBe(label);
    }
    expect(auditActionLabel('order-expense.added')).toBe('Order expense added');
  });

  it('puts the order and child events under Orders and the list events under Order lists', () => {
    const group = (code: string) => AUDIT_ACTIONS.find((action) => action.code === code)?.group;
    const isList = (code: string) =>
      /^(product-type|payment-method|order-expense-category)\./.test(code) && code !== 'product-type.line-linked';

    for (const code of API_ACTIONS.filter((item) => item.startsWith('order') && !isList(item))) {
      expect(group(code), code).toBe('Orders');
    }
    for (const code of API_ACTIONS.filter(isList)) {
      expect(group(code), code).toBe('Order lists');
    }
  });

  it('uses the UI-SPEC labels of the expense and category events', () => {
    expect(auditActionLabel('company-expense.changed')).toBe('Expense changed');
    expect(auditActionLabel('company-expense.payer-changed')).toBe('Expense payer changed');
  });

  it('shows the key itself when the action is unknown', () => {
    expect(auditActionLabel('orders.archived')).toBe('orders.archived');
  });

  it('gives the group of an action code, and null for a code it does not know (D-80)', () => {
    expect(auditActionGroup('order-item.added')).toBe('Orders');
    expect(auditActionGroup('user.deactivated')).toBe('Staff accounts');
    expect(auditActionGroup('product-type.retired')).toBe('Order lists');
    expect(auditActionGroup('orders.archived')).toBeNull();
  });

  it('never repeats a label, so two actions cannot read the same', () => {
    const labels = AUDIT_ACTIONS.map((action) => action.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('describeAuditDetail (D-40)', () => {
  it('reads changed name fields as "Name changed"', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=first-name')).toBe('Name changed');
    expect(describeAuditDetail('user.details-changed', 'fields=first-name,last-name')).toBe('Name changed');
    expect(describeAuditDetail('profile.name-changed', 'fields=last-name')).toBe('Name changed');
  });

  it('reads a changed email as "Email changed"', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=email')).toBe('Email changed');
  });

  it('reads name and email together, each once', () => {
    expect(describeAuditDetail('user.details-changed', 'fields=first-name,email')).toBe('Name changed. Email changed');
  });

  it('reads a role change as "Role: Admin to Manager"', () => {
    expect(describeAuditDetail('user.role-changed', 'role=admin>manager')).toBe('Role: Admin to Manager');
    expect(describeAuditDetail('user.role-changed', 'role=manager>admin')).toBe('Role: Manager to Admin');
  });

  it('reads the words of a resent link and a taken address', () => {
    expect(describeAuditDetail('profile.email-change-requested', 'resent')).toBe('Link sent again');
    expect(describeAuditDetail('profile.email-change-canceled', 'taken')).toBe('That address was taken');
  });

  it('reads the stored reasons of sign-in, lockout, reset and revoked sessions', () => {
    expect(describeAuditDetail('auth.sign-in-failed', 'bad-password')).toBe('Wrong password');
    expect(describeAuditDetail('auth.sign-in-failed', 'unknown-account')).toBe('No account with that email');
    expect(describeAuditDetail('auth.lockout', 'code')).toBe('Too many wrong sign-in codes');
    expect(describeAuditDetail('auth.password-reset-requested', 'capped')).toBe('Too many requests this hour');
    expect(describeAuditDetail('auth.sessions-revoked', 'account-changed')).toBe('The account was changed');
    expect(describeAuditDetail('user.invited', 'manager')).toBe('Invited by a Manager');
  });

  it('gives null when there is no detail or the words are not known', () => {
    expect(describeAuditDetail('user.deactivated', null)).toBeNull();
    expect(describeAuditDetail('user.deactivated', '')).toBeNull();
    expect(describeAuditDetail('user.details-changed', 'fields=shoe-size')).toBeNull();
    expect(describeAuditDetail('user.role-changed', 'role=owner>manager')).toBeNull();
    expect(describeAuditDetail('user.role-changed', 'Role: Carmen to Paolo')).toBeNull();
    expect(describeAuditDetail('orders.archived', 'anything')).toBeNull();
  });

  it('never returns text with an @, even from a stored value that holds an email', () => {
    const stored = ['fields=carmen@example.ph', 'role=carmen@example.ph>manager', 'carmen@example.ph', 'taken@x.y'];
    for (const detail of stored) {
      for (const action of API_ACTIONS) {
        expect(describeAuditDetail(action, detail) ?? '').not.toContain('@');
      }
    }
  });
});

describe('describeAuditDetail for the Phase 11 site content events (AUDIT-01, AUDIT-02)', () => {
  const cases: [string, string, string | null][] = [
    [
      'site-settings.changed',
      'fields=businessName;businessName=Carmen Stitch>Carmen Stitch Works',
      'Business name: Carmen Stitch to Carmen Stitch Works',
    ],
    [
      'site-settings.changed',
      'fields=businessName;businessName=Fit%3B Tailor%3D1>Fit',
      'Business name: Fit; Tailor=1 to Fit',
    ],
    [
      'site-settings.changed',
      'fields=messengerUrl;messengerUrl=>https://m.me/cspsdemo',
      'Messenger link: Not set to https://m.me/cspsdemo',
    ],
    [
      'site-settings.changed',
      'fields=tiktokUrl;tiktokUrl=>https://www.tiktok.com/@cspsdemo',
      'TikTok link: Not set to https://www.tiktok.com/@cspsdemo',
    ],
    [
      'site-settings.changed',
      'fields=aboutText,contactEmail,phones,tagline;tagline=Old line>New line',
      'About text changed. Shop email changed. Phone numbers changed. Tagline changed',
    ],
    ['site-settings.changed', 'fields=businessName;businessName=carmen@example.ph>Carmen', 'Business name changed'],
    ['site-settings.changed', 'fields=quoteAlertsEmail', 'Quote alerts email changed'],
    ['site-settings.changed', 'fields=shoe-size', 'Other detail changed'],
    ['site-settings.share-picture-changed', 'change=added', 'Picture added'],
    ['site-settings.share-picture-changed', 'change=replaced', 'Picture replaced'],
    ['site-settings.share-picture-changed', 'change=removed', 'Picture removed'],
    [
      'opening-hours.changed',
      'monday=closed>09:00-18:00;sunday=10:00-15:00>closed',
      'Monday: Closed to 9:00 AM - 6:00 PM. Sunday: 10:00 AM - 3:00 PM to Closed',
    ],
    ['opening-hours.changed', 'tuesday=00:30-12:00>12:00-23:45', 'Tuesday: 12:30 AM - 12:00 PM to 12:00 PM - 11:45 PM'],
    ['shop-closure.added', 'first=2026-12-25;last=2026-12-25', 'Closed on Dec 25, 2026'],
    [
      'shop-closure.added',
      'first=2026-12-24;last=2026-12-26;fields=note',
      'Closed Dec 24, 2026 to Dec 26, 2026. Note changed',
    ],
    [
      'shop-closure.changed',
      'first=2026-12-25>2026-12-24;last=2026-12-25;fields=note',
      'Closed Dec 24, 2026 to Dec 25, 2026. First day: Dec 25, 2026 to Dec 24, 2026. Note changed',
    ],
    ['shop-closure.changed', 'fields=note', 'Note changed'],
    ['shop-closure.deleted', 'first=2026-12-25;last=2026-12-25', 'Closed on Dec 25, 2026'],
    ['product-line.added', 'key=polo;title=Polo Shirts', 'Product line: Polo Shirts'],
    ['product-line.deleted', 'key=polo;title=Polo Shirts', 'Product line: Polo Shirts'],
    [
      'product-line.changed',
      'fields=title,startsAtPrice,minimumQuantity,cardText;title=Polo>Polo Shirts;price=450.00>500.00;minimum=10>12',
      'Title: Polo to Polo Shirts. Starts-at price: ₱450.00 to ₱500.00. Minimum quantity: 10 to 12. Card text changed',
    ],
    [
      'product-line.changed',
      'fields=startsAtPrice,shortName;price=>450.00;shortName=Polo>Polos',
      'Starts-at price: Not set to ₱450.00. Short name: Polo to Polos',
    ],
    [
      'product-line.changed',
      'fields=description,fabricText,collarText,cutText,namesText,logosText,number',
      'Description changed. Fabric text changed. Collar text changed. Cut text changed. Names text changed. Logos text changed. Number changed',
    ],
    ['product-line.moved', 'title=Polo;position=2>1', 'Product line: Polo. Place: 2 to 1'],
    [
      'product-line.photo-changed',
      'key=polo;title=Polo;slot=main;change=replaced',
      'Product line: Polo. Main photo replaced',
    ],
    [
      'product-line.photo-changed',
      'key=polo;title=Polo;slot=back;change=added',
      'Product line: Polo. Back photo added',
    ],
    [
      'product-line.photo-changed',
      'key=polo;title=Polo;slot=fabric;change=removed',
      'Product line: Polo. Fabric photo removed',
    ],
    ['product-type.line-linked', 'line=Polo>Basketball Jerseys', 'Product line: Polo to Basketball Jerseys'],
    ['product-type.line-linked', 'line=>Polo', 'Product line: Not set to Polo'],
    ['product-type.line-linked', 'line=Polo>', 'Product line: Polo to Not set'],
    ['testimonial.added', 'name=Ana Reyes', 'Testimonial: Ana Reyes'],
    ['testimonial.moved', 'name=Ana Reyes;position=4>1', 'Testimonial: Ana Reyes. Place: 4 to 1'],
    [
      'testimonial.changed',
      'fields=quote,name,teamOrRole,stars;name=Ana>Anna;stars=4>5',
      'Quote changed. Name: Ana to Anna. Team or role changed. Stars: 4 to 5',
    ],
    [
      'gallery-photo.added',
      'team=Sample Ballers;line=Basketball Jerseys',
      'Team: Sample Ballers. Product line: Basketball Jerseys',
    ],
    [
      'gallery-photo.changed',
      'fields=team,line,pieces,note,photo;team=A>B;line=Moto>Polo',
      'Team: A to B. Product line: Moto to Polo. Pieces changed. Note changed. Photo replaced',
    ],
    ['gallery-photo.changed', 'fields=photo', 'Photo replaced'],
    ['gallery-item.moved', 'kind=upload;name=Sample Riders;position=2>1', 'Gallery item: Sample Riders. Place: 2 to 1'],
    [
      'order.public-details-changed',
      'number=ORD-2026-0148;fields=line,name',
      'Product line changed. Name shown changed',
    ],
    ['order.public-details-changed', 'number=ORD-2026-0148;fields=name', 'Name shown changed'],
    ['order.shown-on-website', 'number=ORD-2026-0148', null],
    ['order.taken-off-website', 'number=ORD-2026-0148', null],
    ['order.public-consent-recorded', 'number=ORD-2026-0148', null],
    ['order.public-consent-removed', 'number=ORD-2026-0148', null],
  ];

  it.each(cases)('reads %s "%s" as a fixed sentence', (action, detail, expected) => {
    expect(describeAuditDetail(action, detail)).toBe(expected);
  });

  it('shows "Quote changed" and "Note changed" and never the text, even if a stored pair held it (06 D-27)', () => {
    expect(describeAuditDetail('testimonial.changed', 'fields=quote;quote=Best jerseys ever>Worst jerseys ever')).toBe(
      'Quote changed',
    );
    expect(describeAuditDetail('shop-closure.changed', 'fields=note;note=Fiesta>Typhoon')).toBe('Note changed');
    expect(describeAuditDetail('gallery-photo.changed', 'fields=note;note=Dri-fit>Mesh')).toBe('Note changed');
    expect(describeAuditDetail('product-line.changed', 'fields=cardText;cardText=Secret>Other')).toBe(
      'Card text changed',
    );
    expect(
      describeAuditDetail(
        'site-settings.changed',
        'fields=aboutText,contactEmail,phones;contactEmail=a@b.ph>c@d.ph;phones=0917>0918',
      ),
    ).toBe('About text changed. Shop email changed. Phone numbers changed');
  });

  it('never says an email address, and never returns an @ from a stored email (D-25)', () => {
    expect(describeAuditDetail('testimonial.added', 'name=carmen@example.ph')).toBeNull();
    expect(describeAuditDetail('gallery-photo.added', 'team=carmen@example.ph;line=Polo')).toBe('Product line: Polo');
    expect(describeAuditDetail('product-type.line-linked', 'line=carmen@example.ph>Polo')).toBe('Product line changed');
    expect(describeAuditDetail('opening-hours.changed', 'monday=carmen@example.ph>closed')).toBe('Monday changed');
  });

  it('gives null for a word it does not know and for a detail with no pairs', () => {
    expect(describeAuditDetail('testimonial.moved', 'nothing here')).toBeNull();
    expect(describeAuditDetail('product-line.moved', 'position=oops')).toBeNull();
    expect(describeAuditDetail('site-settings.share-picture-changed', 'change=exploded')).toBeNull();
    expect(describeAuditDetail('product-line.photo-changed', 'key=polo;slot=side;change=added')).toBe('Photo added');
  });
});

const NO_PEOPLE = { fromPerson: null, toPerson: null } as const;

describe('describeAuditChange (D-27)', () => {
  it('reads an amount change in pesos', () => {
    expect(describeAuditChange({ field: 'amount', from: '1200.00', to: '1250.00', ...NO_PEOPLE })).toBe(
      'Amount: ₱1,200.00 to ₱1,250.00',
    );
  });

  it('reads a changed description as the fixed sentence, never as text', () => {
    expect(describeAuditChange({ field: 'description', from: null, to: null, ...NO_PEOPLE })).toBe(
      'Description changed',
    );
  });
});

describe('describeAuditChange for every field (D-27, UI-SPEC A1)', () => {
  const change = (field: string, from: string | null, to: string | null) => ({ field, from, to, ...NO_PEOPLE });

  it('reads dates, categories, notes, names and colors', () => {
    expect(describeAuditChange(change('date', '2026-10-05', '2026-10-06'))).toBe('Date: Oct 5, 2026 to Oct 6, 2026');
    expect(describeAuditChange(change('category', 'Supplies', 'Equipment'))).toBe('Category: Supplies to Equipment');
    expect(describeAuditChange(change('notes', null, null))).toBe('Notes changed');
    expect(describeAuditChange(change('name', 'Supplies', 'Office supplies'))).toBe(
      'Name: Supplies to Office supplies',
    );
    expect(describeAuditChange(change('tone', 'warning', 'success'))).toBe('Color: Amber to Green');
  });

  it('names a category that is gone as "a deleted category"', () => {
    expect(describeAuditChange(change('category', null, 'Equipment'))).toBe(
      'Category: a deleted category to Equipment',
    );
    expect(describeAuditChange(change('category', 'Supplies', null))).toBe('Category: Supplies to a deleted category');
  });

  it('reads a payer change by name and marks former staff', () => {
    const ana = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Reyes', formerStaff: false };
    const bea = { id: '22222222-2222-4222-8222-222222222222', name: 'Bea Navarro', formerStaff: true };

    expect(describeAuditChange({ field: 'payer', from: null, to: null, fromPerson: ana, toPerson: bea })).toBe(
      'Paid by: Ana Reyes to Bea Navarro (former staff)',
    );
  });

  it('reads a single name or color of an added or retired category', () => {
    expect(describeAuditChange(change('name', null, 'Fuel'))).toBe('Name: Fuel');
    expect(describeAuditChange(change('tone', null, 'info'))).toBe('Color: Blue');
  });

  it('reads a line it cannot read as "<Field> changed" (D-81)', () => {
    expect(describeAuditChange(change('tone', 'warning', 'purple'))).toBe('Color changed');
    expect(describeAuditChange(change('date', 'soon', 'later'))).toBe('Date changed');
    expect(describeAuditChange(change('amount', null, '5.00'))).toBe('Amount changed');
    expect(describeAuditChange(change('name', 'Supplies', null))).toBe('Name changed');
  });

  it('reads a field it does not know as "Other detail changed", never its name or values (D-84)', () => {
    const other = describeAuditChange(change('shoe-size', 'small', 'large'));
    expect(other).toBe('Other detail changed');
    expect(other).not.toMatch(/shoe|small|large/i);
    expect(describeAuditChange(change('shoe-size', 'small', 'large'), true)).toBe('Other detail changed');
  });

  it('never puts an unreadable stored value in the fallback sentence', () => {
    const date = describeAuditChange(change('date', 'soon', 'later'));
    expect(date).not.toContain('soon');
    expect(date).not.toContain('later');
    const value = describeAuditChange(change('value', 'five', '10.00'));
    expect(value).toBe('Discount value changed');
    expect(value).not.toContain('five');
    expect(value).not.toContain('10.00');
  });

  it('never returns text from a description or notes line, even if the server sent some', () => {
    expect(describeAuditChange(change('description', 'Private order 7731', 'Another'))).toBe('Description changed');
    expect(describeAuditChange(change('notes', 'Call him', 'Call her'))).toBe('Notes changed');
  });
});

describe('describeAuditSnapshot (D-27)', () => {
  it('names a gone category and leaves out a payer nobody can name', () => {
    expect(describeAuditSnapshot({ date: '2026-10-05', category: null, amount: '12.50', payer: null })).toBe(
      'Oct 5, 2026 · a deleted category · ₱12.50',
    );
  });

  it('reads the facts of an added expense on one line', () => {
    expect(
      describeAuditSnapshot({
        date: '2026-10-05',
        category: 'Utilities',
        amount: 8642.35,
        payer: { id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f', name: 'Ana Reyes', formerStaff: false },
      }),
    ).toBe('Oct 5, 2026 · Utilities · ₱8,642.35 · Paid by Ana Reyes');
  });
});

describe('describeAuditChange for order entries (D-31, ORD-16, ORD-22, ORD-23)', () => {
  const change = (field: string, from: string | null, to: string | null) => ({ field, from, to, ...NO_PEOPLE });
  const ana = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Reyes', formerStaff: false };
  const bea = { id: '22222222-2222-4222-8222-222222222222', name: 'Bea Navarro', formerStaff: true };
  const legacy = { id: '18ed889a-b94d-42f5-a5b0-ee2f47b437cd', name: 'Legacy / unassigned', formerStaff: false };

  it('reads a status move with the seven labels', () => {
    expect(describeAuditChange(change('status', 'ready', 'completed'))).toBe('Status: Ready to Completed');
    expect(describeAuditChange(change('status', 'pending', 'production'))).toBe('Status: Pending to In Production');
    expect(describeAuditChange(change('status', 'completed', 'cancelled'))).toBe('Status: Completed to Cancelled');
    expect(describeAuditChange(change('status', 'mockup', 'delivered'))).toBe('Status: Mockup to Delivered');
    expect(describeAuditChange(change('status', null, 'pending'), true)).toBe('Status: Pending');
    expect(describeAuditChange(change('status', 'ready', 'bogus'))).toBe('Status changed');
  });

  it('reads the order and due dates, with a due date that had no old value', () => {
    expect(describeAuditChange(change('orderDate', '2026-10-28', '2026-10-29'))).toBe(
      'Order date: Oct 28, 2026 to Oct 29, 2026',
    );
    expect(describeAuditChange(change('dueDate', '2026-11-11', '2026-11-18'))).toBe(
      'Due date: Nov 11, 2026 to Nov 18, 2026',
    );
    expect(describeAuditChange(change('dueDate', null, '2026-11-18'), true)).toBe('Due date: Nov 18, 2026');
    expect(describeAuditChange(change('orderDate', 'soon', 'later'))).toBe('Order date changed');
  });

  it('says a first due date on an imported order replaced nothing (D-49d)', () => {
    expect(describeAuditChange(change('dueDate', null, '2026-11-18'))).toBe('Due date: Not set to Nov 18, 2026');
    expect(describeAuditChange(change('dueDate', null, 'soon'))).toBe('Due date changed');
    expect(describeAuditChange(change('orderDate', null, '2026-11-18'))).toBe('Order date changed');
  });

  it('reads quantity and unit price', () => {
    expect(describeAuditChange(change('quantity', '15', '20'))).toBe('Quantity: 15 to 20');
    expect(describeAuditChange(change('quantity', null, '2'), true)).toBe('Quantity: 2');
    expect(describeAuditChange(change('quantity', 'lots', '2'))).toBe('Quantity changed');
    expect(describeAuditChange(change('unitPrice', '650.00', '700.00'))).toBe('Unit price: ₱650.00 to ₱700.00');
    expect(describeAuditChange(change('unitPrice', null, '550.00'), true)).toBe('Unit price: ₱550.00');
    expect(describeAuditChange(change('unitPrice', null, '550.00'))).toBe('Unit price changed');
  });

  it('reads a discount kind and value, a percent value without a peso sign', () => {
    expect(describeAuditChange(change('kind', 'percentage', 'fixed'))).toBe(
      'Discount type: Percentage to Fixed amount',
    );
    expect(describeAuditChange(change('kind', null, 'percentage'), true)).toBe('Discount type: Percentage');
    expect(describeAuditChange(change('kind', 'huge', 'fixed'))).toBe('Discount type changed');
    expect(describeAuditChange(change('value', '5.00%', '10.00%'))).toBe('Discount value: 5% to 10%');
    expect(describeAuditChange(change('value', '5.00%', '500.00'))).toBe('Discount value: 5% to ₱500.00');
    expect(describeAuditChange(change('value', null, '12.50%'), true)).toBe('Discount value: 12.5%');
    expect(describeAuditChange(change('value', 'five', '10.00'))).toBe('Discount value changed');
  });

  it('names payment methods, product types and order categories, or a deleted one', () => {
    expect(describeAuditChange(change('method', 'Cash', 'GCash'))).toBe('Payment method: Cash to GCash');
    expect(describeAuditChange(change('method', null, 'GCash'), true)).toBe('Payment method: GCash');
    expect(describeAuditChange(change('method', null, null), true)).toBe('Payment method: a deleted payment method');
    expect(describeAuditChange(change('productType', 'Polo Shirt', null))).toBe(
      'Product type: Polo Shirt to a deleted product type',
    );
    expect(describeAuditChange(change('category', null, 'Fabric'), true)).toBe('Category: Fabric');
  });

  it('reads receiver, payer and refunder by name, former staff marked, the Legacy holder by its name', () => {
    expect(describeAuditChange({ field: 'receiver', from: null, to: null, fromPerson: ana, toPerson: bea })).toBe(
      'Received by: Ana Reyes to Bea Navarro (former staff)',
    );
    expect(
      describeAuditChange({ field: 'receiver', from: null, to: null, fromPerson: null, toPerson: legacy }, true),
    ).toBe('Received by: Legacy / unassigned');
    expect(describeAuditChange({ field: 'payer', from: null, to: null, fromPerson: bea, toPerson: ana })).toBe(
      'Paid by: Bea Navarro (former staff) to Ana Reyes',
    );
    expect(describeAuditChange({ field: 'refunder', from: null, to: null, fromPerson: ana, toPerson: bea })).toBe(
      'Refunded by: Ana Reyes to Bea Navarro (former staff)',
    );
    expect(
      describeAuditChange({ field: 'refunder', from: null, to: null, fromPerson: null, toPerson: ana }, true),
    ).toBe('Refunded by: Ana Reyes');
    expect(describeAuditChange({ field: 'receiver', from: null, to: null, fromPerson: ana, toPerson: null })).toBe(
      'Receiver changed',
    );
    expect(
      describeAuditChange({ field: 'receiver', from: null, to: null, fromPerson: null, toPerson: null }, true),
    ).toBe('Receiver changed');
    expect(describeAuditChange({ field: 'receiver', from: null, to: null, fromPerson: null, toPerson: bea })).toBe(
      'Receiver changed',
    );
    expect(describeAuditChange({ field: 'payer', from: null, to: null, fromPerson: ana, toPerson: null })).toBe(
      'Payer changed',
    );
    expect(
      describeAuditChange({ field: 'refunder', from: null, to: null, fromPerson: null, toPerson: null }, true),
    ).toBe('Refunder changed');
  });

  it('reads a single amount and date of an added line', () => {
    expect(describeAuditChange(change('amount', null, '3000.00'), true)).toBe('Amount: ₱3,000.00');
    expect(describeAuditChange(change('date', null, '2026-10-25'), true)).toBe('Date: Oct 25, 2026');
    expect(describeAuditChange(change('amount', null, null), true)).toBe('Amount changed');
    expect(describeAuditChange(change('date', null, 'soon'), true)).toBe('Date changed');
  });

  it('says only that a text field changed, never its text', () => {
    const fields: [string, string][] = [
      ['customerName', 'Customer name changed'],
      ['teamName', 'Team name changed'],
      ['contactNumber', 'Contact number changed'],
      ['email', 'Email changed'],
      ['address', 'Address changed'],
      ['notes', 'Notes changed'],
      ['description', 'Description changed'],
      ['sizeVariant', 'Size or variant changed'],
      ['reference', 'Reference changed'],
      ['reason', 'Reason changed'],
    ];
    for (const [field, sentence] of fields) {
      expect(describeAuditChange(change(field, 'Private text', 'More private text')), field).toBe(sentence);
    }
  });
});

describe('isStatedValueAction', () => {
  it('is true for the entries that state each value as it is', () => {
    for (const action of [
      'order.created',
      'order-item.added',
      'order-item.removed',
      'order-payment.added',
      'order-payment.removed',
      'order-refund.added',
      'order-refund.removed',
      'order-discount.added',
      'order-discount.removed',
      'order-expense.added',
      'order-expense.removed',
    ]) {
      expect(isStatedValueAction(action), action).toBe(true);
    }
  });

  it('is false for edits, status moves, snapshots and every other entry', () => {
    for (const action of [
      'order.changed',
      'order.status-changed',
      'order.reopened',
      'order.deleted',
      'order-payment.changed',
      'order-payment.receiver-changed',
      'order-expense.payer-changed',
      'company-expense.added',
      'expense-category.added',
      'product-type.added',
    ]) {
      expect(isStatedValueAction(action), action).toBe(false);
    }
  });
});

describe('describeAuditOrderSnapshot (ORD-16)', () => {
  it('reads the facts of an order on one line with the peso formatter', () => {
    expect(
      describeAuditOrderSnapshot({
        number: 'ORD-2026-0148',
        status: 'cancelled',
        total: 21327.5,
        paid: 12000,
        balance: 9327.5,
      }),
    ).toBe('ORD-2026-0148, Cancelled, total ₱21,327.50, paid ₱12,000.00, balance ₱9,327.50');
  });

  it('reads amounts sent as text and shows a status it does not know as it came', () => {
    expect(
      describeAuditOrderSnapshot({
        number: 'ORD-2026-0001',
        status: 'archived',
        total: '100.00',
        paid: '0.00',
        balance: '100.00',
      }),
    ).toBe('ORD-2026-0001, archived, total ₱100.00, paid ₱0.00, balance ₱100.00');
  });
});

describe('AUDIT_DETAIL_SENTENCES (the list the owner reviews the "What changed" words from, plan 05-37)', () => {
  it('holds every sentence describeAuditDetail can say for a stored word, and says it the same way', () => {
    expect(AUDIT_DETAIL_SENTENCES.length).toBeGreaterThan(20);
    for (const { action, word, sentence } of AUDIT_DETAIL_SENTENCES) {
      expect(describeAuditDetail(action, word), `${action} ${word}`).toBe(sentence);
    }
  });

  it('includes the field, role and reason sentences, each action known to the viewer', () => {
    const sentences = AUDIT_DETAIL_SENTENCES.map((entry) => entry.sentence);

    expect(sentences).toEqual(
      expect.arrayContaining([
        'Name changed',
        'Email changed',
        'Role: Admin to Manager',
        'Wrong password',
        'Link sent again',
      ]),
    );
    for (const { action } of AUDIT_DETAIL_SENTENCES) {
      expect(AUDIT_ACTION_CODES).toContain(action);
    }
  });

  it('lists the fixed Phase 11 words too, with Quote changed and Note changed, so the owner reviews them (AUDIT-02)', () => {
    const phase11 = AUDIT_DETAIL_SENTENCES.filter(
      ({ action }) => auditActionGroup(action) === 'Site content' || action.startsWith('order.public'),
    );
    const sentences = phase11.map((entry) => entry.sentence);

    expect(sentences).toEqual(
      expect.arrayContaining([
        'Quote changed',
        'Note changed',
        'Card text changed',
        'Phone numbers changed',
        'Photo replaced',
        'Picture removed',
        'Name shown changed',
      ]),
    );
    expect(phase11.length).toBeGreaterThan(30);
  });
});
