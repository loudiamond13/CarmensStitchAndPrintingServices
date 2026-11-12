// STUB for the RED commit of plan 11-27 task 1; replaced in GREEN.
import { z } from 'zod';

z.config({ jitless: true });

export const PUBLIC_NAME_MAX = 80;

export function publicWebsiteSchema(hasTeam: boolean) {
  void hasTeam;
  return z.object({
    customerConsent: z.boolean(),
    showOnWebsite: z.boolean(),
    productLineId: z.string(),
    publicName: z.string(),
  });
}

export type PublicWebsiteFormInput = z.input<ReturnType<typeof publicWebsiteSchema>>;
export type PublicWebsiteFormValues = z.output<ReturnType<typeof publicWebsiteSchema>>;

export function toPublicWebsiteRequest(values: PublicWebsiteFormValues, version: string) {
  return { ...values, version };
}
