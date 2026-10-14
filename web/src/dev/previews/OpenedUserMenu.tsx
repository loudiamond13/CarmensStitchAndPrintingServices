// Dev-only scenario wrapper (plan 02-32; never shipped, D-20): the Topbar with its user menu open, as a person opens it
// with a click. The Topbar sits in a `data-ui="s-admin-main"` column as in the admin shell, where it is sticky and so
// the popover's containing block; the block is tall enough to show the popover under the bar. The user menu is a
// SPEC-GAP primitive with no reference, so there is no reference fragment: that side shows its missing-component note.
import { useEffect, useRef } from 'react';
import type { Role } from '@/utils/csps';
import { Topbar } from '@/components/navigation';

const MANAGER: Role = 'manager';

export function OpenedUserMenu() {
  const frame = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not close the menu again.
    if (pressed.current) {
      return;
    }
    pressed.current = true;
    frame.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.click();
  }, []);
  return (
    <div ref={frame} data-ui="s-admin-main" className="min-h-[200px]">
      <Topbar user={{ name: 'Carmen Reyes' }} role={MANAGER} />
    </div>
  );
}
