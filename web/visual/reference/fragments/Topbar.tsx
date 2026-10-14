// Reference side of the admin Topbar (owner ruling D-41 R2-04, 2026-10-13; test only, never shipped): the frozen
// App. D.3 Topbar, rendered unchanged with the same props and no wrapper element, so every DOM path stays the pinned
// design's. The owner replaced the bare "/" search shortcut with Ctrl+K (Cmd+K on Apple platforms), and the hint in
// the search box reads "Ctrl K", or "⌘K" on Apple platforms, instead of "/". App. D.3 draws "/" and CSS cannot change
// a text node, so after mount this side writes the hint into every frozen `.csp-search kbd` that still reads "/". The
// hint text is typed here from the ruling, not imported from the app, so a wording slip on either side shows up as a
// pixel difference. This name shadows the frozen Topbar, which merge-kit.ts allows only through its SPEC_OVERRIDES
// entry (Topbar → D-41). The converted Topbar renders the hint by itself (web/src/components/navigation/Topbar.tsx).
// The frozen component comes from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import { useEffect, type ComponentType } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(
  import.meta.glob<ModuleExports>('../../.reference-src/components/index.tsx', { eager: true }),
)[0];

/** The frozen App. D.3 props the scenarios pass (the frozen Topbar takes them as they are). */
export interface TopbarProps {
  user?: { name: string };
  role?: string;
  placeholder?: string;
  onMenu?: () => void;
  theme?: string;
  onToggleTheme?: () => void;
  onSearch?: (query: string) => void;
}

function frozenTopbar(): ComponentType<TopbarProps> {
  const component = spec?.Topbar;
  if (typeof component !== 'function') {
    throw new Error('The frozen spec has no Topbar. Run node visual/reference/extract-spec.mjs.');
  }
  return component as ComponentType<TopbarProps>;
}

const FrozenTopbar = frozenTopbar();

/** D-41 R2-04: the shortcut hint, "⌘K" on Apple platforms and "Ctrl K" elsewhere. */
function shortcutHint(): string {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K';
}

export function Topbar(props: TopbarProps) {
  useEffect(() => {
    const hint = shortcutHint();
    for (const kbd of document.querySelectorAll('.csp-search kbd')) {
      if (kbd.textContent === '/') {
        kbd.textContent = hint;
      }
    }
  });
  return <FrozenTopbar {...props} />;
}
