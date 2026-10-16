// D-17 holding page: every public path shows it until the Phase 11 pages. A standalone light page root (no site header
// or footer, but the skip link every page keeps, A11Y-02); the head is the App. E.2 page head from PublicPlaceholderPage,
// then the shop facts from copy.ts.
import clsx from 'clsx';
import { Logo } from '@/components/brand/Logo';
import { SkipLink } from '@/components/entry/SkipLink';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { HOLDING_PAGE } from '../copy';

const labelClasses = 'font-display text-[14px] leading-[1.15] font-bold tracking-[.16em] text-ink-muted uppercase';
const rowClasses =
  'grid grid-cols-[160px_1fr] items-center gap-4 border-t border-line py-3 pg-phone:grid-cols-1 pg-phone:gap-1';
const linkClasses =
  'inline-flex min-h-11 items-center text-[18px] leading-[28px] font-semibold text-accent-ink underline underline-offset-4';

export function HoldingPage() {
  const { eyebrow, headline, lead, labels, address, hours, phone, facebook } = HOLDING_PAGE;
  return (
    <div data-theme="light" className={pageRootClasses}>
      <SkipLink />
      <main id="main" tabIndex={-1} className="min-h-dvh">
        <div className="mx-auto max-w-(--container-max) px-6 pt-8 pg-phone:px-4 pg-phone:pt-6">
          <Logo size="md" tagline={false} />
        </div>
        <section className="relative overflow-hidden bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] pt-16 pb-12 pg-phone:pt-8 pg-phone:pb-8">
          <div className="mx-auto flex max-w-(--container-max) flex-col gap-[20px] px-6 pg-phone:px-4">
            <span className="inline-flex items-center gap-2 font-display text-[14px] leading-[1.15] font-bold tracking-[.16em] text-accent-ink uppercase before:h-[3px] before:w-[24px] before:[transform:skewX(-18deg)] before:bg-accent-line">
              {eyebrow}
            </span>
            <h1 className="font-display text-[80px] leading-[.88] font-heavy tracking-[-.01em] uppercase italic pg-phone:text-[52px]">
              {headline.plain} <em className="text-accent-ink italic">{headline.accent}</em>
            </h1>
            <p className="max-w-[560px] text-[18px] leading-[28px] text-ink-muted pg-phone:text-[16px] pg-phone:leading-[24px]">
              {lead}
            </p>
          </div>
        </section>
        <ul className="mx-auto flex max-w-[720px] flex-col px-6 pb-12 pg-phone:px-4 pg-phone:pb-8">
          <li className={rowClasses}>
            <span className={labelClasses}>{labels.address}</span>
            <span className="text-[18px] leading-[28px]">{address}</span>
          </li>
          <li className={rowClasses}>
            <span className={labelClasses}>{labels.hours}</span>
            <span className="text-[18px] leading-[28px]">{hours}</span>
          </li>
          <li className={rowClasses}>
            <span className={labelClasses}>{labels.phone}</span>
            <a href={phone.href} className={linkClasses}>
              {phone.text}
            </a>
          </li>
          <li className={clsx(rowClasses, 'border-b')}>
            <span className={labelClasses}>{labels.facebook}</span>
            <a href={facebook.href} rel="noopener noreferrer" className={linkClasses}>
              {facebook.text}
            </a>
          </li>
        </ul>
      </main>
    </div>
  );
}
