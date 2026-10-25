// The Settings looks (S1; plan 06-17) as complete Tailwind tokens (D-33). The card, its head and its body reuse the My Profile card
// recipe; only what that recipe lacks is here. Every string is a class list (the class gate compiles each one).
import { tw } from '@/ui/tw';

/** The Others sub line: 12px muted, 4px under the badge (UI-SPEC S1). */
export const settingsSublineClasses = tw('block text-[12px] leading-4 text-ink-muted');

/** The category cell: the badge, then the optional sub line, stacked and start-aligned. */
export const settingsCategoryCellClasses = tw('flex min-w-0 flex-col items-start gap-1');

/** The head's text block: the title over the hint, taking the room beside the Add Category button. */
export const settingsHeadTextClasses = tw('flex min-w-0 flex-col gap-1');

/** Add Category moves under the hint at full width on phones. */
export const settingsAddButtonClasses = tw('pg-phone:w-full');
