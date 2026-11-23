// The photo kit loads the first time a visitor taps to add photos (D-43), so the form's own piece keeps its budget. A failed load is
// not remembered: the next tap asks again.
export type QuotePhotoKit = typeof import('../quotePhotoKit');

export const loadQuotePhotoKit = (): Promise<QuotePhotoKit> => import('../quotePhotoKit');
