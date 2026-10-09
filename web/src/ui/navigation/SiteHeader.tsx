// SiteHeader (App. D.3 "Navigation", CSPS-UI-SPEC.md §6.6, UI-SPEC Layout Contract "Header"), converted to utilities
// (D-33) with App. D.3's props API, markup and copy: the home-linked lockup, the "Main" links, the small primary
// "Get a Quote" and, on phones, the burger that opens the "Mobile" drawer. App. D.3's `.is-on` / `.is-open` class hooks
// are gone: the current link is read from `aria-current="page"` (UI-SPEC rule 6), and `.is-open` has no rule. Owner
// rulings applied:
//   - D-03 the current link is bold (700) as its second cue, besides the ink colour and the orange underline;
//   - D-31 O-3 the current drawer link carries `aria-current="page"` too, and turns italic as its second cue.
// The SiteHeader renders its own Logo, so it passes it the header context (the App. C phone tagline, UI-SPEC rule 7a).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, UiLink } from '@/ui/actions';
import { Icon, Logo } from '@/ui/brand';
import {
  siteBurgerClasses,
  siteCtaClasses,
  siteDrawerClasses,
  siteDrawerCtaClasses,
  siteDrawerLinkClasses,
  siteHeaderClasses,
  siteHeaderInnerClasses,
  siteLinkClasses,
  siteLogoLinkClasses,
  siteNavClasses,
} from './navigation.recipe';

/** One public site link: its label (matched by `active`) and its path. */
export interface NavLinkItem {
  label: string;
  to: string;
}

/** The public site links in order (App. D.3 SITE_LINKS, spec §6.6). */
export const SITE_LINKS: readonly NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
];

/** Where "Get a Quote" takes the visitor (UI-SPEC Layout Contract, Interaction Contract "Primary CTA"). */
const QUOTE_PATH = '/contact';

export interface SiteHeaderProps {
  links?: readonly NavLinkItem[] | undefined;
  /** The label of the current link (`aria-current="page"`); a label no link has marks none current. */
  active?: string | undefined;
  /** Replaces the default "Get a Quote" action (going to /contact). */
  onQuote?: (() => void) | undefined;
}

export function SiteHeader({ links = SITE_LINKS, active = 'Home', onQuote }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // SPEC-DEVIATION: UI-SPEC Layout Contract "Get a Quote navigates to /contact". App. D.3 leaves the action to an
  // optional onQuote; without one the button now goes to /contact. It stays App. D.3's <button> (no element change, D-08),
  // and from the drawer it also closes the drawer, as the drawer links do.
  const quote = (): void => {
    setOpen(false);
    if (onQuote === undefined) {
      void navigate(QUOTE_PATH);
    } else {
      onQuote();
    }
  };
  return (
    <header className={siteHeaderClasses}>
      <div className={siteHeaderInnerClasses}>
        <UiLink to="/" className={siteLogoLinkClasses}>
          <Logo size="sm" context="siteHeader" />
        </UiLink>
        <nav className={siteNavClasses} aria-label="Main">
          {links.map((link) => (
            <UiLink
              key={link.label}
              to={link.to}
              className={siteLinkClasses}
              aria-current={link.label === active ? 'page' : undefined}
            >
              {link.label}
            </UiLink>
          ))}
        </nav>
        <Button variant="primary" size="sm" iconRight="arrow-right" className={siteCtaClasses} onClick={quote}>
          Get a Quote
        </Button>
        <button
          type="button"
          className={siteBurgerClasses}
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
      </div>
      {open && (
        <nav className={siteDrawerClasses} aria-label="Mobile">
          {links.map((link) => (
            // SPEC-DEVIATION: D-31 O-3 the current drawer link gets aria-current="page" (App. D.3 marks it by class
            // only), which also drives its italic second cue.
            <UiLink
              key={link.label}
              to={link.to}
              onClick={() => {
                setOpen(false);
              }}
              className={siteDrawerLinkClasses}
              aria-current={link.label === active ? 'page' : undefined}
            >
              {link.label}
              <Icon name="arrow-right" size={20} />
            </UiLink>
          ))}
          <Button variant="primary" block iconRight="arrow-right" className={siteDrawerCtaClasses} onClick={quote}>
            Get a Quote
          </Button>
        </nav>
      )}
    </header>
  );
}
