// The Public Website window rules (OR-3; plan 11-27): the browser checks every rule of the order's public settings before a request is sent,
// with the server's own words (OrderPublicSettings.cs). Every control is text or a tick; an empty line or name is sent as null. The form is
// shared with the New Order and Edit Order card (plan 11-35). The server's order of checks is kept: the name length first, then, only when
// the order is shown, the customer's OK, the line and the name.
import { z } from 'zod';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import type { SetOrderPublicSettingsRequest } from '@/modules/admin/services/publicWebsiteService';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });

const COPY = PUBLIC_WEBSITE_COPY.errors;

/** The longest name shown (OrderPublicSettings.PublicNameMaxLength). */
export const PUBLIC_NAME_MAX = 80;

/** The form for an order that has a team (`hasTeam`) or none: an order with no team needs a name typed to be shown. */
export function publicWebsiteSchema(hasTeam: boolean) {
  return z
    .object({
      customerConsent: z.boolean(),
      showOnWebsite: z.boolean(),
      productLineId: z.string(),
      publicName: z.string(),
    })
    .superRefine((data, context) => {
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
      if (data.productLineId === '') {
        context.addIssue({ code: 'custom', message: COPY.lineRequired, path: ['productLineId'] });
      }
      if (name === '' && !hasTeam) {
        context.addIssue({ code: 'custom', message: COPY.nameRequired, path: ['publicName'] });
      }
    });
}

export type PublicWebsiteFormInput = z.input<ReturnType<typeof publicWebsiteSchema>>;
export type PublicWebsiteFormValues = z.output<ReturnType<typeof publicWebsiteSchema>>;

/** The request body: no line and no name are null, the name is trimmed, and the version is the order's. */
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
