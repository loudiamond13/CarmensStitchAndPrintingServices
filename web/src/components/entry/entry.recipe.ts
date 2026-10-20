// SPEC-GAP: entry looks (UI-SPEC "SPEC-GAP Primitive Specs": MoneyInput, OtpInput, Checkbox, RadioGroup, SkipLink). The entry
// primitives add only these few looks; type, colour, height and the invalid border come from the reused recipes
// (field.recipe.ts, button.recipe.ts, layout.recipe.ts). Every string in this file is a class list (the class gate
// compiles them all).
import { tw } from '@/ui/tw';

/**
 * MoneyInput `align="right"` (App. E.9 item rows): the amount sits at the end of the box. Field puts layout classes on
 * its wrapper, so the rule reaches the text box from there, as the reference's `.csp-field.text-right .csp-input` did.
 */
export const moneyAlignRightClasses = tw('[&_input]:text-right');

/** OtpInput fieldset (the reference's `.csp-otp`): no margin, padding or border; type comes from the legend. */
export const otpGroupClasses = tw('m-0 border-0 p-0');

/** The OtpInput legend sits 8px above the boxes (`.csp-otp > legend`); its look is the label recipe. */
export const otpLegendClasses = tw('pb-2');

/** The row of six boxes: gap 8px, 4px on pages up to 420px wide, so six 44px boxes fit 320px. */
export const otpBoxesClasses = tw('flex gap-2 pg-xs:gap-1');

/** One box (the field-control look) shares the row: grows equally, 44px to 56px wide. */
export const otpBoxClasses = tw('max-w-14 min-w-11 flex-[1_1_0]');

/** The digit inside a box: centred tabular figures (type and height come from the field-input recipe). */
export const otpDigitClasses = tw('text-center tabular-nums');

/** App. C `.s-check`: the label row (flex, centred, gap 8px, 14px --ink-muted, pointer). */
export const checkLabelClasses = tw('flex cursor-pointer items-center gap-2 text-[14px] text-ink-muted');

/** The 20×20 cell the checkbox and its tick share (one grid cell, so the tick needs no positioning). */
export const checkCellClasses = tw('grid flex-none');

/**
 * D-03 (C-35) checkbox, replacing the native look: appearance none, 20×20, 2px --ink border, --radius-xs, --surface-2
 * fill, pointer; checked: --accent fill. The 2px focus-visible ring with its 2px offset is kept. `peer` lets the tick
 * follow the checked state.
 */
export const checkInputClasses = tw(
  'peer col-start-1 row-start-1 m-0 size-5 cursor-pointer appearance-none rounded-xs border-2 border-ink bg-surface-2 checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
);

/**
 * D-03 (C-35) tick in --on-accent, geometry from 74621f5 (D-37): a 10×5px box with 2px bottom and left borders, 3px up
 * from the centre of the cell, rotated -45deg. Shown only while the box is checked (`peer-checked:`); no image URL.
 */
export const checkTickClasses = tw(
  'pointer-events-none col-start-1 row-start-1 -mt-[3px] hidden h-[5px] w-[10px] -rotate-45 place-self-center border-b-2 border-l-2 border-on-accent peer-checked:block',
);

/** RadioGroup fieldset: no border, margin or padding; the options are a column 8px apart. */
export const radioGroupClasses = tw('m-0 flex min-w-0 flex-col gap-2 border-0 p-0');

/** The RadioGroup legend sits 8px above the first option; its look is the label recipe. */
export const radioLegendClasses = tw('pb-2');

/** One option: the whole row is the click target, at least 44px tall, 4px above and below, control and text 8px apart. */
export const radioRowClasses = tw('flex min-h-11 cursor-pointer items-center gap-2 py-1');

/** The 20×20 cell the radio and its dot share (one grid cell, so the dot needs no positioning). */
export const radioCellClasses = tw('grid flex-none');

/**
 * The checkbox look made round (P2 D-03): 2px --ink border, --surface-2 ground, --accent ground when checked. `peer` lets
 * the dot follow the checked state.
 */
export const radioInputClasses = tw(
  'peer col-start-1 row-start-1 m-0 size-5 cursor-pointer appearance-none rounded-full border-2 border-ink bg-surface-2 checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
);

/** The 8×8 --on-accent dot, centred in the cell and shown only while the radio is checked. */
export const radioDotClasses = tw(
  'pointer-events-none col-start-1 row-start-1 hidden size-2 place-self-center rounded-full bg-on-accent peer-checked:block',
);

/** The text column: the option label over its description; it may wrap beside the control and the row grows. */
export const radioTextClasses = tw('flex min-w-0 flex-col');

/** The option label: Label 14/600 in --ink. */
export const radioLabelClasses = tw('text-[14px] leading-5 font-semibold wrap-anywhere text-ink');

/** The option description: Small 14/400 in --ink-muted. */
export const radioDescriptionClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink-muted');

/**
 * SkipLink visibility and position on top of the primary md button look: the `.csp-sr` look (srOnlyClasses in
 * layout.recipe.ts) while it does not have keyboard focus, with the button padding and border dropped so the box
 * really is 1px; with keyboard focus, fixed 8px from the top left above everything (`--z-toast`).
 */
export const skipLinkClasses = tw(
  'not-focus-visible:absolute not-focus-visible:h-px not-focus-visible:w-px not-focus-visible:overflow-hidden not-focus-visible:border-0 not-focus-visible:p-0 not-focus-visible:whitespace-nowrap not-focus-visible:[clip:rect(0_0_0_0)] focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-(--z-toast)',
);
