// The [C]SPS lockup (CSPS-UI-SPEC.md §4.2, App. D.3 Logo, App. B `/* ── Logo ── */`): the mark stands in for the C,
// then "SPS" with the skewed orange slash, then the two-line tagline. App. D.3's markup, props and copy are kept; the
// `.csp-logo*` looks are utilities from brand.recipe.ts (D-33). The App. D.3 `csp-logo-v-<variant>` hook classes have
// no rules in App. B, so they are dropped (class names only, D-33).
import clsx from 'clsx';
import {
  logoClasses,
  logoContextClasses,
  logoGapClasses,
  logoLetterClasses,
  logoLetterContextClasses,
  logoLetterMarkClasses,
  logoLetterMarkContextClasses,
  logoLettersClasses,
  logoLettersContextClasses,
  logoSlashClasses,
  logoTaglineClasses,
  logoTaglineContextClasses,
  logoTaglineSizeClasses,
  logoWordClasses,
  type LogoContext,
  type LogoSize,
} from './brand.recipe';
import { Mark } from './Mark';

/** The mark's own width and height attributes per lockup size (App. D.3 MARK_SIZE; spec §4.2 "Mark px"). */
const MARK_SIZE = { sm: 36, md: 56, lg: 104 } as const satisfies Record<LogoSize, number>;

export interface LogoProps {
  size?: LogoSize;
  variant?: 'full' | 'wordmark' | 'mark';
  tagline?: boolean;
  /**
   * The region the lockup sits in, set by the src/components component that renders it (UI-SPEC rule 7a): `sidebar` takes the
   * nav ink of the Sidebar (App. B `.csp-sidebar .csp-logo`), `siteHeader` the smaller phone tagline of the public
   * header (App. C `.csp-site-header .csp-logo-tag`), `footer` the smaller phone md lockup of the public footer (App. C
   * `.s-foot .csp-logo-md`). Defaults to the plain look.
   */
  context?: LogoContext;
  /** Layout glue only. */
  className?: string;
}

/** [C]SPS — the mark stands in for the C. One image named for the business; its parts are hidden. */
export function Logo({ size = 'md', tagline = true, variant = 'full', context = 'default', className }: LogoProps) {
  return (
    <span
      className={clsx(logoClasses, logoContextClasses[context], logoGapClasses[size], className)}
      role="img"
      aria-label="CSPS — Carmen's Stitch & Printing Services"
    >
      {variant === 'mark' && <Mark size={MARK_SIZE[size]} />}
      {variant === 'full' && (
        <span
          className={clsx(logoWordClasses, logoLetterClasses[size], logoLetterContextClasses[context])}
          aria-hidden="true"
        >
          <Mark size={MARK_SIZE[size]} className={clsx(logoLetterMarkClasses, logoLetterMarkContextClasses[context])} />
          <span
            className={clsx(
              logoLettersClasses,
              logoLetterClasses[size],
              logoLetterContextClasses[context],
              logoLettersContextClasses[context],
            )}
          >
            SPS
            <span className={logoSlashClasses} />
          </span>
        </span>
      )}
      {variant === 'wordmark' && (
        <span
          className={clsx(
            logoLettersClasses,
            logoLetterClasses[size],
            logoLetterContextClasses[context],
            logoLettersContextClasses[context],
          )}
          aria-hidden="true"
        >
          CSPS
          <span className={logoSlashClasses} />
        </span>
      )}
      {variant !== 'mark' && tagline && (
        <span
          className={clsx(logoTaglineClasses, logoTaglineContextClasses[context], logoTaglineSizeClasses[size])}
          aria-hidden="true"
        >
          {"Carmen's Stitch"}
          <br />
          {'& Printing Services'}
        </span>
      )}
    </span>
  );
}
