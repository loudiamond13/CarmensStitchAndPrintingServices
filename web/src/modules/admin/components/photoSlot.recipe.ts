// The PhotoSlot looks (UI-SPEC S1 card 6 and S4 card 5; plan 11-22) as complete Tailwind tokens (D-33). The status line, the spinner and the
// pick-error box are the Phase 9 looks (components/media/media.recipe.ts); only what those do not give is here. No new token.
import { tw } from '@/ui/tw';

/** One slot, a fieldset with no border: the preview, the hint, the buttons and the status line, 8px apart. */
export const slotClasses = tw('m-0 flex min-w-0 flex-col items-start gap-2 border-0 p-0');

/** The slot's name over its preview (Label), the fieldset's legend. */
export const slotLabelClasses = tw('mb-2 p-0 text-[14px] leading-5 font-semibold text-ink');

/** The frame of the preview: Main photo 4:5 and Back view and Fabric detail 1:1 at 160px wide, the link preview picture 1.91:1 at 320px wide (full width on a phone). */
export const slotFrameClasses = {
  '4/5': tw('aspect-[4/5] w-40 max-w-full shrink-0 overflow-hidden rounded-sm bg-surface-2'),
  '1/1': tw('aspect-square w-40 max-w-full shrink-0 overflow-hidden rounded-sm bg-surface-2'),
  '1.91/1': tw('aspect-[1.91/1] w-full shrink-0 overflow-hidden rounded-sm bg-surface-2 min-[640px]:w-80'),
} as const;

/** The drawn jersey in an empty Main photo: it fills the frame with a little room round it. */
export const slotArtClasses = tw('size-full p-3');

/** The type and size hint under the preview (Small, muted). */
export const slotHintClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');

/** The buttons of the slot: a wrapping row. */
export const slotActionsClasses = tw('flex flex-wrap items-center gap-2');

/** The camera button shows only where hover is none (a phone or tablet), as in the order photo add area. */
export const slotTouchOnlyClasses = tw('hidden no-hover:contents');

/** The status line under the buttons: one line high even when it is empty, so the card does not jump. */
export const slotStatusClasses = tw('flex min-h-5 items-center gap-1 text-[14px] leading-5 text-ink-muted');

/** The pick-error box fills the slot's width. */
export const slotPickErrorClasses = tw('w-full');
