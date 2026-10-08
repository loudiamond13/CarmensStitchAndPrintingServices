// UiLink and LinkProvider (App. D.3 "links"), converted (D-33). App. D.3 reads a router link component from
// LinkProvider's context and renders it; react-hooks/static-components rejects a component chosen at render time, so
// UiLink renders react-router's Link itself (research Flag 2). Link outputs the same plain <a href>, so the DOM matches
// the approved design. External, mail, phone and in-page targets stay plain anchors, exactly as App. D.3 decides.
// SPEC-DEVIATION: L-13 the props are explicit (no {...rest} spread onto the anchor); the ones App. D/E callers use are
// listed in UiLinkProps.
import type { AnchorHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { Link } from 'react-router';

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
  ref?: Ref<HTMLAnchorElement> | undefined;
}

/** App. D.3's test: these targets are never router paths. */
const EXTERNAL = /^(https?:|mailto:|tel:|#)/;

export function UiLink({
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
  ref,
}: UiLinkProps) {
  if (EXTERNAL.test(to)) {
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
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      ref={ref}
      to={to}
      className={className}
      id={id}
      title={title}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      aria-describedby={ariaDescribedBy}
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
