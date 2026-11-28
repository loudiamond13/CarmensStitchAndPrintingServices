// UiLink and LinkProvider (App. D.3 "links"), converted (D-33). App. D.3 reads a router link component from
// LinkProvider's context and renders it; react-hooks/static-components rejects a component chosen at render time, so
// UiLink renders react-router's Link itself (research Flag 2). Link outputs the same plain <a href>, so the DOM matches
// the approved design. External, mail, phone and in-page targets stay plain anchors, exactly as App. D.3 decides.
// SPEC-DEVIATION: L-13 the props are explicit (no {...rest} spread onto the anchor); the ones App. D/E callers use are
// listed in UiLinkProps.
// SPEC-DEVIATION: MOTION-VT (PERF-07, 14 D-33) a link to another page asks the router for a View Transition (the browser's
// own cross-fade) only when the browser is Chromium-engine with the API (14 D-48), the device allows motion, the link is not inside a drawer
// (`noTransition`) and the target is not the page already shown. Otherwise it passes none, so the router never warns.
import type { AnchorHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { Link, useLocation, useResolvedPath } from 'react-router';
import { canStartViewTransition, usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface UiLinkProps {
  /** An in-app path ("/products") or an external, mailto:, tel: or #in-page target. Never unparsed URL input. */
  to: string;
  /** Layout glue only (margin, placement, width); never a restyle (spec rule 3). */
  className?: string | undefined;
  children?: ReactNode | undefined;
  id?: string | undefined;
  title?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  onClick?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  'aria-label'?: string | undefined;
  'aria-current'?: AnchorHTMLAttributes<HTMLAnchorElement>['aria-current'] | undefined;
  'aria-describedby'?: string | undefined;
  /** Names the link from other elements (the Sidebar's rail items, whose visible label the tablet rail hides). */
  'aria-labelledby'?: string | undefined;
  /** A menu item inside a `role="menu"` (the UserMenu's "My Profile", plan 02-32). */
  role?: 'menuitem' | undefined;
  /** The roving tab stop of a menu item (-1: reached by the arrow keys, not by Tab). */
  tabIndex?: number | undefined;
  ref?: Ref<HTMLAnchorElement> | undefined;
  /** Skips the page fade, for links inside a drawer whose own exit is the change. */
  noTransition?: boolean | undefined;
}

/** App. D.3's test: these targets are never router paths. */
const EXTERNAL = /^(https?:|mailto:|tel:|#)/;

export function UiLink(props: UiLinkProps) {
  if (!EXTERNAL.test(props.to)) {
    return <AppLink {...props} />;
  }
  const {
    to,
    className,
    children,
    id,
    title,
    target,
    rel,
    onClick,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
    'aria-describedby': ariaDescribedBy,
    'aria-labelledby': ariaLabelledBy,
    role,
    tabIndex,
    ref,
  } = props;
  return (
    <a
      ref={ref}
      href={to}
      className={className}
      id={id}
      title={title}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </a>
  );
}

/** An in-app path: react-router's Link, with a View Transition only where the fade is wanted. */
function AppLink({
  to,
  className,
  children,
  id,
  title,
  target,
  rel,
  onClick,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  role,
  tabIndex,
  ref,
  noTransition,
}: UiLinkProps) {
  const reduce = usePrefersReducedMotion();
  const samePage = useResolvedPath(to).pathname === useLocation().pathname;
  const fade = noTransition !== true && !reduce && !samePage && canStartViewTransition();
  return (
    <Link
      ref={ref}
      to={to}
      viewTransition={fade}
      className={className}
      id={id}
      title={title}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      role={role}
      tabIndex={tabIndex}
    >
      {children}
    </Link>
  );
}

export interface LinkProviderProps {
  /** App. D.3's router link adapter. Accepted for API compatibility and unused: UiLink renders react-router's Link. */
  component?: unknown;
  children: ReactNode;
}

// SPEC-DEVIATION: router link built in (Flag 2). App. D.3's LinkProvider puts the router link component in a context
// for UiLink; UiLink now renders react-router's Link directly, so LinkProvider only renders its children unchanged.
export function LinkProvider({ children }: LinkProviderProps) {
  return children;
}
