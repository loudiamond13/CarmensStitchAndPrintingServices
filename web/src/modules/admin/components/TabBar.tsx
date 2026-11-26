// The phone tab bar (App. E.6 `nav.s-tabbar`, App. C `.s-tabbar` / `.s-tab-i`; spec §8.1), converted to utilities
// (D-33) with App. E.6's markup and copy: an "Admin" navigation of links, each a 22px icon over its short label
// (Dashboard, Orders, Quotes, Expenses, Profile). Users has no tab. The current link is read from `aria-current="page"` (App.
// E.6's `.is-on`) and is bold as its second cue (D-03). The bar shows only in the phone container (App. C). The links
// are plain Tab stops, as App. E.6 has them (a navigation, not a tab list).
// SPEC-DEVIATION: OQ-2 (D-30) with `withQuotes`, a fifth "Quotes" tab after Orders, with the New count chip at its icon and in
// its name (D-14).
import clsx from 'clsx';
import { useId } from 'react';
import { UiLink } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { formatNavCount, navCountName, type AdminSection, type SidebarProps } from '@/components/navigation';
import {
  tabBarClasses,
  tabBarColumnClasses,
  tabBarCountClasses,
  tabIconBoxClasses,
  tabIconClasses,
  tabItemClasses,
} from './admin.recipe';

/** One tab: its section, its short label (App. E.6), its icon and path (ADMIN_NAV). */
export interface TabBarItem {
  readonly id: AdminSection;
  readonly label: string;
  readonly icon: IconName;
  readonly to: string;
}

/** App. E.6's four tabs, in order. */
export const TAB_BAR_ITEMS: readonly TabBarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', to: '/admin' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-list', to: '/admin/orders' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt', to: '/admin/expenses' },
  { id: 'profile', label: 'Profile', icon: 'user-round', to: '/admin/profile' },
];

/** The Quotes tab (D-30): after Orders when the bar has it. */
export const QUOTES_TAB_ITEM: TabBarItem = {
  id: 'quotes',
  label: 'Quotes',
  icon: 'inbox',
  to: '/admin/quote-requests',
};

export interface TabBarProps {
  /** The current section; a section with no tab (Users) marks none. */
  active?: AdminSection | undefined;
  /** Adds the Quotes tab after Orders (D-30). The real admin shell sets it, so the parity scenarios keep App. E.6's four. */
  withQuotes?: boolean | undefined;
  /** A count per section; above 0 the tab shows it as a chip and in its name. */
  counts?: SidebarProps['counts'];
}

export function TabBar({ active, withQuotes = false, counts }: TabBarProps) {
  const idBase = useId();
  const items = withQuotes
    ? TAB_BAR_ITEMS.flatMap((item) => (item.id === 'orders' ? [item, QUOTES_TAB_ITEM] : [item]))
    : TAB_BAR_ITEMS;
  const columns = withQuotes ? tabBarColumnClasses.five : tabBarColumnClasses.four;
  return (
    <nav className={clsx(tabBarClasses, columns)} aria-label="Admin">
      {items.map((item) => {
        const count = counts?.[item.id] ?? 0;
        const shown = count > 0 ? formatNavCount(count) : null;
        const icon = <Icon name={item.icon} size={22} className={tabIconClasses} />;
        const nameId = `${idBase}-${item.id}-count`;
        return (
          <UiLink
            key={item.id}
            to={item.to}
            className={tabItemClasses}
            aria-current={active === item.id ? 'page' : undefined}
            aria-labelledby={shown === null ? undefined : nameId}
          >
            {shown === null ? (
              icon
            ) : (
              <span className={tabIconBoxClasses}>
                {icon}
                <span aria-hidden="true" className={tabBarCountClasses}>
                  {shown}
                </span>
              </span>
            )}
            {item.label}
            {shown !== null && (
              <span id={nameId} className={srOnlyClasses}>
                {navCountName(item.label, shown)}
              </span>
            )}
          </UiLink>
        );
      })}
    </nav>
  );
}
