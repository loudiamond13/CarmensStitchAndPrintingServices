// The photo pick rules (OR-3, IMG-02; plan 09-16): the browser checks every rule of the upload endpoint before a request is sent,
// with the server's own words. The numbers come from GET /orders/image-rules, never from this file.
import type { ImageRulesResponse } from '@/modules/admin/services/orderPhotosService';

/** The server's photo rules as plain numbers (the generated types allow a number or a numeric string). */
export interface ImageRules {
  maxPerOrder: number;
  maxBytes: number;
  maxPixels: number;
  maxSide: number;
  types: readonly string[];
  descriptionMaxLength: number;
}

export function toImageRules(response: ImageRulesResponse): ImageRules {
  return {
    maxPerOrder: Number(response.maxPerOrder),
    maxBytes: Number(response.maxBytes),
    maxPixels: Number(response.maxPixels),
    maxSide: Number(response.maxSide),
    types: response.types,
    descriptionMaxLength: Number(response.descriptionMaxLength),
  };
}
