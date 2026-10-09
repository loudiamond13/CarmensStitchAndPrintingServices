// RED stub (plan 02-26 Task 2): the converted SiteHeader arrives in GREEN.
export interface NavLinkItem {
  label: string;
  to: string;
}
export const SITE_LINKS: readonly NavLinkItem[] = [];
export interface SiteHeaderProps {
  links?: readonly NavLinkItem[];
  active?: string;
  onQuote?: () => void;
}
export function SiteHeader(_props: SiteHeaderProps) {
  return <header data-stub="" />;
}
