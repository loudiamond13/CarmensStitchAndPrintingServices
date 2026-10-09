// The phone tab bar (App. E.6 `nav.s-tabbar`, App. C `.s-tabbar` / `.s-tab-i`; spec §8.1), converted to utilities
// (D-33) with App. E.6's markup and copy: an "Admin" navigation of four links, each a 22px icon over its short label
// (Dashboard, Orders, Expenses, Profile). Users has no tab. The current link is read from `aria-current="page"` (App.
// E.6's `.is-on`) and is bold as its second cue (D-03). The bar shows only in the phone container (App. C). The links
// are plain Tab stops, as App. E.6 has them (a navigation, not a tab list).
import { UiLink } from '@/ui/actions';
import { Icon, type IconName } from '@/ui/brand';
import type { AdminSection } from '@/ui/navigation';
import { tabBarClasses, tabIconClasses, tabItemClasses } from './admin.recipe';

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

export interface TabBarProps {
  /** The current section; a section with no tab (Users) marks none. */
  active?: AdminSection | undefined;
}

export function TabBar({ active }: TabBarProps) {
  return (
    <nav className={tabBarClasses} aria-label="Admin">
      {TAB_BAR_ITEMS.map((item) => (
        <UiLink
          key={item.id}
          to={item.to}
          className={tabItemClasses}
          aria-current={active === item.id ? 'page' : undefined}
        >
          <Icon name={item.icon} size={22} className={tabIconClasses} />
          {item.label}
        </UiLink>
      ))}
    </nav>
  );
}
