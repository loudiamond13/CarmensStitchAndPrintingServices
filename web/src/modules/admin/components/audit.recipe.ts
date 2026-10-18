// The Audit Log looks (UI-SPEC A1; plan 05-33) as complete Tailwind tokens (D-33). Every string here is a class list (the class
// gate compiles each one).
import { tw } from '@/ui/tw';

/** The h1 and its "Manager only" badge in one wrapping row, 10px apart (as the Users header). */
export const auditTitleRowClasses = tw('flex flex-wrap items-center gap-2.5');

/** The expanded row's `dl` in the RecordMeta look: terms and values in two columns (max-content, then the rest), 8px by 16px apart; stacked on phones. */
export const auditDetailClasses = tw('grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 pg-phone:grid-cols-1');

/** One term and its value: they share the list's two columns; stacked on phones, 4px apart. */
export const auditDetailRowClasses = tw(
  'col-span-2 grid grid-cols-subgrid pg-phone:col-span-1 pg-phone:grid-cols-1 pg-phone:gap-y-1',
);

/** `dt`: the Label look (14px, 600) in `--ink-muted`. */
export const auditDetailTermClasses = tw('text-[14px] leading-5 font-semibold text-ink-muted');

/** `dd`: the Small look (14px, 400) in `--ink`; a long value (the reference, a device) wraps anywhere instead of widening the row. */
export const auditDetailValueClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink');
