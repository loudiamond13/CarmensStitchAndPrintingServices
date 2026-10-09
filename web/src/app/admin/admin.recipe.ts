// The admin shell looks (App. C `/* ───────── admin ───────── */` and its `@container pg` rules, spec §8.1; plan 02-31)
// as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles each one). The
// breakpoints are the `pg-*` container variants with App. C's own query text, so the shell switches at exactly the
// approved widths. Context looks of the components inside the shell (the sticky Sidebar and Topbar, the tablet icon
// rail) are `in-data-[ui=s-admin-side]:` / `in-data-[ui=s-admin-main]:` variants in the navigation recipes.
import { tw } from '@/ui/tw';

/** `.s-admin`: the sidebar column and the main column side by side. */
export const adminClasses = tw('flex min-h-full bg-bg text-ink');

/** `.s-admin-side`: the sidebar column (`data-ui="s-admin-side"`), hidden on phones. */
export const adminSideClasses = tw('relative flex-none pg-phone:hidden');

/** `.s-admin-main`: the topbar, the body and the phone tab bar in one column (`data-ui="s-admin-main"`). */
export const adminMainClasses = tw('flex min-w-0 flex-1 flex-col');

/** `.s-body`: 32 32 48 with 24px gaps, up to 1440px wide; 24 24 48 on tablets; 20 16 32 with 20px gaps on phones. */
export const adminBodyClasses = tw(
  'flex w-full max-w-[1440px] flex-col gap-6 px-8 pt-8 pb-12 pg-phone:gap-5 pg-phone:px-4 pg-phone:pt-5 pg-phone:pb-8 pg-tablet:px-6 pg-tablet:pt-6 pg-tablet:pb-12',
);
