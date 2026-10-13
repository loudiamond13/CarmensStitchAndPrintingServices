import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as navigationScenarios } from '@/dev/scenarios/groups/navigation';
import type { Role } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { iconButtonClasses } from '@/ui/feedback';
import { Topbar } from '@/ui/navigation';
import { searchShortcutHint } from './Topbar';
import {
  searchClasses,
  searchInputClasses,
  searchInputCompatClasses,
  searchKbdClasses,
  topbarClasses,
  topbarMenuClasses,
  topbarRightClasses,
  userMenuClasses,
  userMenuTextClasses,
} from './navigation.recipe';

// The converted App. D.3 Topbar (plan 02-26, CSPS-UI-SPEC.md §6.6, UI-SPEC Interaction Contract "Topbar search" and
// "Theme toggle", Color D-01): App. D.3's markup, props and copy. Ctrl+K or Cmd+K (D-41 R2-04, replacing App. D.3's
// bare "/") focuses the search box from anywhere outside a field, Enter hands the text to onSearch, the theme toggle is named for what it will do, and the user-menu button
// announces its menu. The phone menu button passes through the aria-expanded / aria-controls the mobile drawer needs
// (plan 02-31). The look is proven by the parity suite (`--grep @navigation`).

// L-20: the user role goes through a typed variable, never a literal role prop.
const ADMIN: Role = 'admin';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function search(): HTMLInputElement {
  return screen.getByRole('searchbox', { name: 'Search' });
}

const byId = new Map(navigationScenarios.map((scenario) => [scenario.id, scenario]));

/** Renders a navigation scenario exactly as the parity page does: through the implementation kit, in a router. */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No navigation scenario "${id}".`);
  }
  return render(<MemoryRouter>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>);
}

describe('Topbar markup (App. D.3)', () => {
  it('is the menu button, the search box and the right-hand group, in that order', () => {
    const { container } = render(<Topbar onToggleTheme={vi.fn()} theme="light" />);
    const bar = container.firstElementChild;

    expect(hasClasses(bar, topbarClasses)).toBe(true);
    expect([...(bar?.children ?? [])].map((child) => child.localName)).toEqual(['button', 'label', 'div']);
    expect(bar?.children[0]).toBe(screen.getByRole('button', { name: 'Open navigation' }));
    expect(hasClasses(bar?.children[0], topbarMenuClasses)).toBe(true);
    expect(hasClasses(bar?.children[2], topbarRightClasses)).toBe(true);
  });

  it('labels the search box, with its icon, the placeholder, 14px text (16px on phones, D-01) and the shortcut hint', () => {
    render(<Topbar />);
    const box = search().parentElement;

    expect(box?.localName).toBe('label');
    expect(hasClasses(box, searchClasses)).toBe(true);
    expect([...(box?.children ?? [])].map((child) => child.localName)).toEqual(['svg', 'input', 'kbd']);
    expect(search().getAttribute('type')).toBe('search');
    expect(search().placeholder).toBe('Search orders, customers, teams…');
    expect(hasClasses(search(), searchInputClasses)).toBe(true);
    expect(hasClasses(search(), searchInputCompatClasses)).toBe(true);
    expect(tokens(searchInputCompatClasses)).toEqual(['px-[2px]', 'py-px']);
    expect(search().classList.contains('text-[14px]')).toBe(true);
    expect(search().classList.contains('pg-phone:text-[16px]')).toBe(true);
    const kbd = box?.querySelector('kbd');
    // D-41 R2-04: the hint names the modifier shortcut (jsdom's user agent is not an Apple one).
    expect(kbd?.textContent).toBe('Ctrl K');
    expect(hasClasses(kbd, searchKbdClasses)).toBe(true);
    expect(search().getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
  });

  it.each([
    ['Macintosh', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'],
  ])('shows the "⌘K" hint on a %s', (_device, userAgent) => {
    const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    render(<Topbar />);

    expect(search().parentElement?.querySelector('kbd')?.textContent).toBe('⌘K');
    agent.mockRestore();
  });

  it.each([
    ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0'],
    ['Android', 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0'],
    ['Linux', 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'],
  ])('chooses the "Ctrl K" hint on %s, and "⌘K" on an iPod (searchShortcutHint)', (_platform, userAgent) => {
    expect(searchShortcutHint(userAgent)).toBe('Ctrl K');
    expect(searchShortcutHint('Mozilla/5.0 (iPod touch; CPU iPhone OS 18_0 like Mac OS X)')).toBe('⌘K');
  });

  it('lets the search box shrink below its content (D-41 R2-01), keeping every App. B token', () => {
    expect(tokens(searchClasses)).toEqual(
      [
        'flex',
        'h-10',
        'max-w-[480px]',
        'min-w-0',
        'flex-1',
        'items-center',
        'gap-2',
        'rounded-sm',
        'border',
        'border-line',
        'bg-surface-2',
        'px-3',
        'text-ink-muted',
        'focus-within:border-focus',
        'focus-within:[box-shadow:0_0_0_1px_var(--focus)]',
        'pg-tablet:max-w-none',
      ].sort(),
    );
  });

  it('takes another placeholder', () => {
    render(<Topbar placeholder="Search users…" />);
    expect(search().placeholder).toBe('Search users…');
  });

  it('shows the user menu button: a menu trigger with the avatar, name, role and chevron', () => {
    const { rerender } = render(<Topbar />);
    const menu = screen.getByRole('button', { name: /Carmen Reyes/ });

    expect(menu.getAttribute('aria-haspopup')).toBe('menu');
    expect(menu.getAttribute('type')).toBe('button');
    expect(hasClasses(menu, userMenuClasses)).toBe(true);
    expect(within(menu).getByRole('img', { name: 'Carmen Reyes' }).classList.contains('bg-surface-2')).toBe(true);
    expect(hasClasses(menu.children[1], userMenuTextClasses)).toBe(true);
    expect(menu.children[1]?.textContent).toBe('Carmen ReyesManager');
    expect(menu.lastElementChild?.localName).toBe('svg');

    rerender(<Topbar user={{ name: 'Lea Santos' }} role={ADMIN} />);
    expect(screen.getByRole('button', { name: /Lea Santos/ }).children[1]?.textContent).toBe('Lea SantosAdmin');
  });
});

describe('Topbar menu button (phones)', () => {
  it('calls onMenu and leaves out aria-expanded / aria-controls unless they are given', async () => {
    const onMenu = vi.fn();
    const { rerender } = render(<Topbar onMenu={onMenu} />);
    const menu = screen.getByRole('button', { name: 'Open navigation' });

    expect(menu.hasAttribute('aria-expanded')).toBe(false);
    expect(menu.hasAttribute('aria-controls')).toBe(false);
    await userEvent.click(menu);
    expect(onMenu).toHaveBeenCalledOnce();

    rerender(<Topbar onMenu={onMenu} menuExpanded={false} menuControls="mobile-nav" />);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(menu.getAttribute('aria-controls')).toBe('mobile-nav');

    rerender(<Topbar onMenu={onMenu} menuExpanded menuControls="mobile-nav" />);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Topbar theme toggle', () => {
  it('is named for what it will do, with the moon in light and the sun in dark, and calls onToggleTheme', async () => {
    const onToggleTheme = vi.fn();
    const { rerender } = render(<Topbar theme="light" onToggleTheme={onToggleTheme} />);
    const toLight = screen.getByRole('button', { name: 'Switch to dark mode' });

    expect(hasClasses(toLight, iconButtonClasses)).toBe(true);
    expect(toLight.querySelector('svg')?.getAttribute('class')).toContain('lucide-moon');
    await userEvent.click(toLight);
    expect(onToggleTheme).toHaveBeenCalledOnce();

    rerender(<Topbar theme="dark" onToggleTheme={onToggleTheme} />);
    const toDark = screen.getByRole('button', { name: 'Switch to light mode' });
    expect(toDark.querySelector('svg')?.getAttribute('class')).toContain('lucide-sun');
  });

  it('is left out without onToggleTheme', () => {
    render(<Topbar theme="light" />);
    expect(screen.queryByRole('button', { name: /^Switch to/ })).toBeNull();
  });
});

describe('Topbar search keys', () => {
  // D-41 R2-04 (owner, 2026-10-13): Ctrl+K or Cmd+K focuses the search box from outside a field; a bare "/" no longer
  // does (WCAG 2.1.4 no longer applies, because the shortcut needs a modifier). The UI-WR-07 guards stay.
  function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it.each([
    ['Ctrl+K', { key: 'k', ctrlKey: true }],
    ['Cmd+K', { key: 'k', metaKey: true }],
    ['Ctrl+K with Caps Lock', { key: 'K', ctrlKey: true }],
    ['Cmd+K with Caps Lock', { key: 'K', metaKey: true }],
    ['Ctrl+K on a non-Latin layout', { key: 'л', code: 'KeyK', ctrlKey: true }],
  ])('focuses the search box on %s pressed outside a field, and takes the key', (_what, init) => {
    render(<Topbar />);
    const event = press(document.body, init);

    expect(document.activeElement).toBe(search());
    expect(event.defaultPrevented).toBe(true);
  });

  it('focuses the search box on Ctrl+K sent to the window itself', () => {
    render(<Topbar />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    expect(document.activeElement).toBe(search());
  });

  it.each([
    ['a bare "/"', { key: '/' }],
    ['a bare "/" with Shift', { key: '/', shiftKey: true }],
    ['a bare "k"', { key: 'k' }],
    ['Ctrl+/', { key: '/', ctrlKey: true }],
    ['Ctrl+Shift+K', { key: 'K', ctrlKey: true, shiftKey: true }],
    ['Ctrl+Alt+K', { key: 'k', ctrlKey: true, altKey: true }],
    ['Ctrl+Cmd+K', { key: 'k', ctrlKey: true, metaKey: true }],
    ['Ctrl+K during an IME composition', { key: 'k', ctrlKey: true, isComposing: true }],
    ['Ctrl+T on Dvorak (the physical K key)', { key: 't', code: 'KeyK', ctrlKey: true }],
    ['Ctrl+J', { key: 'j', ctrlKey: true }],
  ])('leaves %s alone', (_what, init) => {
    render(<Topbar />);
    const event = press(document.body, init);

    expect(document.activeElement).not.toBe(search());
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(['input', 'textarea', 'select'])('leaves Ctrl+K alone inside a %s', (tag) => {
    render(<Topbar />);
    const field = document.createElement(tag);
    document.body.append(field);
    field.focus();
    const event = press(field, { key: 'k', ctrlKey: true });

    expect(document.activeElement).not.toBe(search());
    expect(event.defaultPrevented).toBe(false);
    field.remove();
  });

  it('leaves Ctrl+K alone inside editable content', () => {
    render(<Topbar />);
    const editor = document.createElement('div');
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.append(editor);
    const event = press(editor, { key: 'k', ctrlKey: true });

    expect(document.activeElement).not.toBe(search());
    expect(event.defaultPrevented).toBe(false);
    editor.remove();
  });

  it('leaves a Ctrl+K that something else already handled alone', () => {
    render(<Topbar />);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    event.preventDefault();

    document.body.dispatchEvent(event);
    expect(document.activeElement).not.toBe(search());
  });

  it.each(['textbox', 'searchbox', 'combobox', 'spinbutton'])(
    'leaves Ctrl+K alone inside a role="%s" widget',
    (role) => {
      render(<Topbar />);
      const widget = document.createElement('div');
      widget.setAttribute('role', role);
      widget.tabIndex = 0;
      const inner = document.createElement('span');
      widget.append(inner);
      document.body.append(widget);
      const event = press(inner, { key: 'k', ctrlKey: true });

      expect(document.activeElement).not.toBe(search());
      expect(event.defaultPrevented).toBe(false);
      widget.remove();
    },
  );

  it('leaves Ctrl+K alone while a modal dialog is open, so focus never leaves the dialog', () => {
    render(<Topbar />);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    const event = press(document.body, { key: 'k', ctrlKey: true });

    expect(document.activeElement).not.toBe(search());
    expect(event.defaultPrevented).toBe(false);

    dialog.remove();
    press(document.body, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(search());
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<Topbar />);

    unmount();
    const event = press(document.body, { key: 'k', ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
  });

  it('hands the text to onSearch on Enter, and nothing on other keys or without onSearch', async () => {
    const onSearch = vi.fn();
    const { rerender } = render(<Topbar onSearch={onSearch} />);

    await userEvent.type(search(), 'Tondo');
    expect(onSearch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('Tondo');

    rerender(<Topbar />);
    await userEvent.type(search(), '{Enter}');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('renders the same markup again for the same props, and the new bar for new props', () => {
    const { container, rerender } = render(<Topbar theme="light" />);
    const first = container.innerHTML;

    rerender(<Topbar theme="light" />);
    expect(container.innerHTML).toBe(first);

    rerender(<Topbar theme="dark" onToggleTheme={vi.fn()} />);
    expect(container.innerHTML).not.toBe(first);
  });
});

describe('Topbar scenarios and axe', () => {
  it('lists the topbar cases the parity suite compares: Blush with the moon, Espresso with the sun', () => {
    const topbar = navigationScenarios.filter((s) => s.id.startsWith('topbar-'));
    expect(topbar.map((s) => [s.id, s.states.join('+'), s.themes.join('+'), s.responsive])).toEqual([
      ['topbar-light', 'rest+hover+focus-visible', 'light', true],
      ['topbar-dark', 'rest+hover+focus-visible', 'dark', true],
    ]);
    expect(topbar.every((s) => s.group === 'navigation' && s.parity && s.node.component === 'Topbar')).toBe(true);
  });

  it.each([
    ['topbar-light', 'Switch to dark mode'],
    ['topbar-dark', 'Switch to light mode'],
  ])('%s renders through the kit with its theme toggle and no axe violations', async (id, toggle) => {
    const { container } = renderCase(id);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(screen.getByRole('button', { name: toggle })).toBeDefined();
    await expectNoAxeViolations(container);
  });
});
