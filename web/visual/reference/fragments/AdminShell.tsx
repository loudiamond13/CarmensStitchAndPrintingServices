// Reference side of the admin frame (plan 02-31; test only, never shipped): a JSX transcription of the App. E.6 shell,
// `div.s-admin` > `div.s-admin-side` (the frozen App. D.3 Sidebar) and `div.s-admin-main` (the frozen Topbar through
// the D-41 Topbar override in ./Topbar.tsx, which writes the owner-ruled shortcut hint; `main.s-body`, `nav.s-tabbar`), for the dev user Carmen Reyes (Manager). App. E.6's design-canvas links become paths
// (spec §2.9). The body holds the AdminPreviewPage content, which App. E has no screen for, written with the spec
// looks it is built from (UI-SPEC "Phase 2 pages"): the `.s-ph` page head (h1 = the nav label, the dev subline) and an
// App. B `.csp-empty` empty state with the section's nav icon and a primary md link. The empty-state title is an h2,
// as in the implementation (A11Y-02), since the frozen EmptyState always renders an h3. With `frameWidth` a second
// `.s-page` that wide holds the frame, as on the implementation side (web/src/dev/previews/AdminShell.tsx).
//
// A11Y-01 (as the KeyboardScrollTable and DefinedTotalsNote pairs do): on the tablet rail App. C hides the nav labels
// with `display: none`, so the approved links and Logout lose their accessible names (axe link-name). The converted
// Sidebar names each item with `aria-labelledby` (its label, plus the "Manager" tag on a Users row that is not current)
// by itself; this side adds the same attribute to the frozen items after mount. Attributes are not compared, so the
// look is still compared in full, and axe checks both pages.
//
// The frozen components come from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import { useEffect, useId, useRef, type ComponentType, type ReactNode } from 'react';
import { Topbar } from './Topbar';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

function frozen<P extends object>(name: string): ComponentType<P> {
  const component = spec?.[name];
  if (typeof component !== 'function') {
    throw new Error(`The frozen spec has no ${name}. Run node visual/reference/extract-spec.mjs.`);
  }
  return component as ComponentType<P>;
}

interface Person {
  name: string;
}

const Sidebar = frozen<{ active?: string; role?: string; user?: Person; onLogout?: () => void }>('Sidebar');
const Icon = frozen<{ name: string; size?: number }>('Icon');
const ButtonLink = frozen<{ variant?: string; size?: string; to: string; children?: ReactNode }>('ButtonLink');

const ME: Person = { name: 'Carmen Reyes' };
/** The dev user's role, through a typed constant (L-20). */
const MANAGER: 'manager' | 'admin' = 'manager';

/** The sections the scenarios show: the nav label (h1) and nav icon (App. D.3 ADMIN_NAV). */
const SECTIONS = {
  dashboard: { label: 'Dashboard', icon: 'layout-dashboard' },
  users: { label: 'Users', icon: 'users' },
} as const;

/** App. E.6's four tabs. */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', to: '/admin' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-list', to: '/admin/orders' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt', to: '/admin/expenses' },
  { id: 'profile', label: 'Profile', icon: 'user-round', to: '/admin/profile' },
] as const;

function noop(): undefined {
  return undefined;
}

export interface AdminShellProps {
  section?: keyof typeof SECTIONS;
  theme?: 'light' | 'dark';
  frameWidth?: number;
}

/** Names every frozen nav item and Logout by its own label (and a shown "Manager" tag), as the converted Sidebar does. */
function nameNavItems(root: HTMLElement, idBase: string): void {
  root.querySelectorAll<HTMLElement>('.csp-sidebar .csp-nav').forEach((item, index) => {
    const parts = [item.querySelector<HTMLElement>('.csp-nav-label')];
    if (!item.classList.contains('is-on')) {
      parts.push(item.querySelector<HTMLElement>('.csp-nav-tag'));
    }
    const ids = parts
      .filter((part): part is HTMLElement => part !== null)
      .map((part, position) => {
        part.id = `${idBase}-${String(index)}-${String(position)}`;
        return part.id;
      });
    item.setAttribute('aria-labelledby', ids.join(' '));
  });
}

export function AdminShell({ section = 'dashboard', theme = 'light', frameWidth }: AdminShellProps) {
  const { label, icon } = SECTIONS[section];
  const shell = useRef<HTMLDivElement>(null);
  const idBase = useId();
  useEffect(() => {
    if (shell.current !== null) {
      nameNavItems(shell.current, idBase);
    }
  }, [idBase]);
  const frame = (
    <div className="s-admin" ref={shell}>
      <div className="s-admin-side">
        <Sidebar active={section} role={MANAGER} user={ME} onLogout={noop} />
      </div>
      <div className="s-admin-main">
        <Topbar user={ME} role={MANAGER} theme={theme} onToggleTheme={noop} />
        <main className="s-body">
          <div className="s-ph">
            <div className="s-ph-title">
              <h1>{label}</h1>
              <p>Development only. This screen is built in a later phase.</p>
            </div>
          </div>
          <div className="csp-empty">
            <span className="csp-empty-icon">
              <Icon name={icon} size={28} />
            </span>
            <h2 className="csp-empty-title">Nothing to show here yet</h2>
            <p className="csp-empty-msg">
              Until this screen is built, the Component Showcase shows every shared building block.
            </p>
            <ButtonLink variant="primary" size="md" to="/dev/components">
              Open Component Showcase
            </ButtonLink>
          </div>
        </main>
        <nav className="s-tabbar" aria-label="Admin">
          {TABS.map((tab) => (
            <a key={tab.id} className={tab.id === section ? 's-tab-i is-on' : 's-tab-i'} href={tab.to}>
              <Icon name={tab.icon} size={22} />
              {tab.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
  if (frameWidth === undefined) {
    return frame;
  }
  return (
    <div className="s-page" style={{ width: frameWidth, maxWidth: '100%' }}>
      {frame}
    </div>
  );
}
