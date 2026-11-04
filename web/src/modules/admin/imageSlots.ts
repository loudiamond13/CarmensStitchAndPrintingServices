// The `sizes` strings of the image slots (UI-SPEC "Image Delivery", IMG-04). The server builds every address and srcset
// (the client never assembles a Cloudinary address); these strings only tell the browser how wide a slot shows.

/** The Orders list grid card cover: 4 / 3 / 2 / 1 columns beside the 248px sidebar, with the body padding. */
export const CARD_SIZES =
  '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(50vw - 34px), (max-width: 1279px) 310px, 330px';

/** The photo viewer stage: the viewport minus the nav columns, up to 956px. */
export const VIEWER_SIZES = '(max-width: 639px) calc(100vw - 32px), min(956px, calc(100vw - 176px))';
