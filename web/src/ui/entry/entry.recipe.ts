// SPEC-GAP: entry looks (UI-SPEC "SPEC-GAP Primitive Specs": MoneyInput, OtpInput, Checkbox, SkipLink). The entry
// primitives add only these few looks; type, colour, height and the invalid border come from the reused recipes
// (field.recipe.ts, button.recipe.ts, layout.recipe.ts). Every string in this file is a class list (the class gate
// compiles them all).
import { tw } from '@/ui/tw';

/**
 * MoneyInput `align="right"` (App. E.9 item rows): the amount sits at the end of the box. Field puts layout classes on
 * its wrapper, so the rule reaches the text box from there, as the reference's `.csp-field.text-right .csp-input` did.
 */
export const moneyAlignRightClasses = tw('[&_input]:text-right');
