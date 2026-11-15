// The public website rules of an order (OR-3; plans 11-27 and 11-35): the browser checks every rule of the order's public settings before a
// request is sent, with the server's own words (OrderPublicSettings.cs and OrderPublicWebsiteFieldsValidator). Every control is text or a
// tick; an empty line or name is sent as null. The Public Website window, the New Order form and the Edit Order form share the shape,
// the rules and the request block. The server's order of checks is kept: the name length first, then, only when the order is shown,
// the customer's OK, the line and the name.
import { z } from 'zod';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import type { CreateOrderRequest, OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { SetOrderPublicSettingsRequest } from '@/modules/admin/services/publicWebsiteService';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = PUBLIC_WEBSITE_COPY.errors;

/** The longest name shown (OrderPublicSettings.PublicNameMaxLength). */
export const PUBLIC_NAME_MAX = 80;

/** The four values, as the window and the order forms hold them. */
export const publicWebsiteShape = {
  customerConsent: z.boolean(),
  showOnWebsite: z.boolean(),
  productLineId: z.string(),
  publicName: z.string(),
};

const publicWebsiteFields = z.object(publicWebsiteShape);

export type PublicWebsiteFormInput = z.input<typeof publicWebsiteFields>;
export type PublicWebsiteFormValues = z.output<typeof publicWebsiteFields>;

/** What the rules need to know besides the four values. */
export interface PublicWebsiteRules {
  /** The order has a team name (on a form, the one typed there): an order with no team needs a name typed to be shown. */
  hasTeam: boolean;
  /** Showing needs a line chosen. False on a new order, where the server works the line out from the items on save. */
  lineRequired: boolean;
}

/** The rules of the four values, as issues on their fields. Shared by the window and by both order forms. */
export function checkPublicWebsite(
  data: PublicWebsiteFormInput,
  rules: PublicWebsiteRules,
  context: z.RefinementCtx,
): void {
  const name = data.publicName.trim();
  if (name.length > PUBLIC_NAME_MAX) {
    context.addIssue({ code: 'custom', message: COPY.nameTooLong, path: ['publicName'] });
  }
  if (!data.showOnWebsite) {
    return;
  }
  if (!data.customerConsent) {
    context.addIssue({ code: 'custom', message: COPY.consentFirst, path: ['showOnWebsite'] });
  }
  if (rules.lineRequired && data.productLineId === '') {
    context.addIssue({ code: 'custom', message: COPY.lineRequired, path: ['productLineId'] });
  }
  if (name === '' && !rules.hasTeam) {
    context.addIssue({ code: 'custom', message: COPY.nameRequired, path: ['publicName'] });
  }
}

/** The form for an order that has a team (`hasTeam`) or none: an order with no team needs a name typed to be shown. */
export function publicWebsiteSchema(hasTeam: boolean) {
  return publicWebsiteFields.superRefine((data, context) => {
    checkPublicWebsite(data, { hasTeam, lineRequired: true }, context);
  });
}

/** A card nobody touched: nothing ticked, no line, no name. */
export function blankPublicWebsite(): PublicWebsiteFormInput {
  return { customerConsent: false, showOnWebsite: false, productLineId: '', publicName: '' };
}

/** What the form shows for an order: the line is the one the order is shown under, else the server's auto line, else empty. */
export function publicWebsiteValuesOf(order: Pick<OrderDetailResponse, 'publicWebsite'>): PublicWebsiteFormInput {
  const block = order.publicWebsite;
  return {
    customerConsent: block.customerConsent,
    showOnWebsite: block.shownOnWebsite,
    productLineId: block.productLineId ?? block.autoProductLineId ?? '',
    publicName: block.publicName ?? '',
  };
}

/** The request body for the window: no line and no name are null, the name is trimmed, and the version is the order's. */
export function toPublicWebsiteRequest(
  values: PublicWebsiteFormValues,
  version: string,
): SetOrderPublicSettingsRequest {
  const name = values.publicName.trim();
  return {
    customerConsent: values.customerConsent,
    showOnWebsite: values.showOnWebsite,
    productLineId: values.productLineId === '' ? null : values.productLineId,
    publicName: name === '' ? null : name,
    version,
  };
}

/** The `publicWebsite` block an order form sends. */
export type PublicWebsiteBlock = NonNullable<CreateOrderRequest['publicWebsite']>;

function sameValues(a: PublicWebsiteFormInput, b: PublicWebsiteFormInput): boolean {
  return (
    a.customerConsent === b.customerConsent &&
    a.showOnWebsite === b.showOnWebsite &&
    a.productLineId === b.productLineId &&
    a.publicName.trim() === b.publicName.trim()
  );
}

/**
 * The block an order form sends with the order, or undefined while the card still holds what it started with (`before`): a card nobody
 * touched sends nothing, so the order's public settings stay as they are. Once one value changed the whole block goes, so an all-off
 * block is how the OK is taken back.
 */
export function toPublicWebsiteBlock(
  values: PublicWebsiteFormInput,
  before: PublicWebsiteFormInput = blankPublicWebsite(),
): PublicWebsiteBlock | undefined {
  if (sameValues(values, before)) {
    return undefined;
  }
  const name = values.publicName.trim();
  return {
    customerConsent: values.customerConsent,
    showOnWebsite: values.showOnWebsite,
    productLineId: values.productLineId === '' ? null : values.productLineId,
    publicName: name === '' ? null : name,
  };
}
