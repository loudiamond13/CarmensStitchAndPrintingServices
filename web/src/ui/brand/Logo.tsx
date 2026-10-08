// RED stub (plan 02-18): replaced by the converted lockup in the GREEN commit.
export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'wordmark' | 'mark';
  tagline?: boolean;
  className?: string;
}

export function Logo(_props: LogoProps) {
  return <span role="img" aria-label="CSPS — Carmen's Stitch & Printing Services" />;
}
