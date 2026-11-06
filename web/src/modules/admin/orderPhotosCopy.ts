// The words of the order photo screens (UI-SPEC Copywriting Contract, Phase 9; plan 09-16): one module, no wording in JSX.
// The photo list, tile and viewer words are in components/media/copy.ts. Strings the spec names are verbatim. No long dash (OR-4).
// Strings marked "gap" are not in the spec and wait for the owner's wording.

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const failedLine = (failed: number, total: number): string =>
  `${String(failed)} of ${String(total)} ${plural(total, 'photo', 'photos')} didn't upload.`;

export const ORDER_PHOTOS_COPY = {
  /** The card title on F1, O1 and X2. */
  title: 'Images',
  hints: {
    /** F1: the photos upload after the order is saved. */
    draft: 'Mockups and reference photos. They upload after you save the order.',
    /** O1 and X2. */
    live: 'Mockups and reference photos. The cover shows on the Orders list.',
  },
  /** The text kept when staff leave a description empty (D-12, D-30). */
  defaultDescription: {
    saved: (number: string, position: number): string => `Order ${number} photo ${String(position)}`,
    draft: (position: number): string => `New order photo ${String(position)}`,
  },
  /** The note that replaces the add area at the limit. */
  limit: {
    live: (max: number): string =>
      `This order has ${String(max)} photos, the most it can have. Delete one to add another.`,
    draft: (max: number): string =>
      `You've picked ${String(max)} photos, the most an order can have. Remove one to pick another.`,
  },
  /** The status line on the card head. */
  status: {
    uploading: (index: number, total: number): string => `Uploading photo ${String(index)} of ${String(total)}`,
    saved: 'Saved',
  },
  /** The visually hidden polite region. */
  announce: {
    moved: (position: number, total: number): string => `Moved to position ${String(position)} of ${String(total)}.`,
    movedCover: (total: number): string => `Moved to position 1 of ${String(total)}. It's now the cover.`,
    descriptionSaved: 'Description saved.',
    deleted: (left: number): string =>
      `Photo deleted. ${left === 0 ? 'No photos left.' : plural(left, '1 photo left.', `${String(left)} photos left.`)}`,
    uploaded: (index: number, total: number): string => `Photo ${String(index)} of ${String(total)} uploaded.`,
    allUploaded: 'All photos uploaded.',
    someFailed: (failed: number, total: number): string => failedLine(failed, total),
    alreadyDeleted: 'That photo was already deleted.',
  },
  /** The partial-failure banner (D-10). */
  banner: {
    title: (failed: number, total: number): string => failedLine(failed, total),
    body: "They're below. Try again or remove them. If you leave this page, they're lost.",
  },
  /** The leave guard (OQ-5, D-29). */
  leave: {
    title: 'Leave this page?',
    // Gap: the spec words only the singular start, "1 photo hasn't uploaded yet."; the end follows the plural line.
    message: (count: number): string =>
      count === 1
        ? "1 photo hasn't uploaded yet. If you leave now, it's lost."
        : `${String(count)} photos haven't uploaded yet. If you leave now, they're lost.`,
    stay: 'Stay on Page',
    leave: 'Leave Page',
  },
  toasts: {
    added: {
      title: 'Photos added',
      message: (count: number, number: string): string =>
        `${String(count)} ${plural(count, 'photo', 'photos')} added to ${number}.`,
    },
    reloaded: {
      title: 'Photos reloaded',
      message: 'Someone changed this order. The latest photos are shown. Try again if you still need to.',
    },
    changeFailed: { title: "Couldn't save the photo change" },
  },
  /** Why a picked file was refused or an upload failed, in the server's own words where the server has them (OR-3). */
  reasons: {
    type: (name: string): string => `${name} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.`,
    size: (name: string, size: string): string => `${name} is over ${size}. Choose a smaller photo.`,
    pixels: (name: string, megapixels: number): string =>
      `${name} is too big. Photos can be at most ${String(megapixels)} megapixels.`,
    unreadable: (name: string): string => `${name} couldn't be read. Try another photo.`,
    descriptionTooLong: (limit: number): string => `Keep the description to ${String(limit)} characters or fewer.`,
    network: "Couldn't upload. Check your connection, then try again.",
    rateLimited: 'Too many uploads right now. Wait a minute, then try again.',
    server: (traceId: string | undefined): string =>
      traceId === undefined ? 'Something went wrong.' : `Something went wrong. Reference: ${traceId}`,
    // Gap: the rules could not be read, so the pick cannot be checked.
    rulesUnavailable: "Couldn't check this photo. Check your connection, then try again.",
    // Gap: a refusal the server sent without a message.
    refused: "The server didn't accept this photo.",
  },
  /** The description window (P5). */
  description: {
    title: 'Edit Description',
    forOrder: (number: string, position: number, total: number): string =>
      `${number} · Photo ${String(position)} of ${String(total)}`,
    forNewOrder: (position: number, total: number): string =>
      `New order · Photo ${String(position)} of ${String(total)}`,
    label: 'Photo description',
    hint: 'Screen readers read this out. For example: Front mockup, red and black.',
    cancel: 'Cancel',
    save: 'Save Description',
    saving: 'Saving',
    removed: { title: 'This photo was removed.', body: 'Close this and check the order.' },
  },
  /** The delete dialog (P7). */
  delete: {
    title: (position: number): string => `Delete photo ${String(position)}?`,
    message: (number: string): string => `It's removed from ${number} right away. This can't be undone.`,
    cancel: 'Cancel',
    confirm: 'Delete Photo',
    pending: 'Deleting',
  },
} as const;
