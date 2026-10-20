import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActorName, RecordMeta } from '@/components/data';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { expectNoAxeViolations } from '@/test/axe';
import {
  actorFormerClasses,
  recordMetaClasses,
  recordMetaRowClasses,
  recordMetaTermClasses,
  recordMetaValueClasses,
} from './data.recipe';

// ActorName and RecordMeta (SEC-08, D-08, D-11, OQ-8; plan 05-25): who recorded and last changed a record, with a deleted
// colleague still named and a record made before actors were recorded reading "System".

const CARMEN = { name: 'Carmen Reyes', formerStaff: false };
const ANA = { name: 'Ana Cruz', formerStaff: true };
// 07:42 UTC is 3:42 PM in Manila (UTC+8).
const RECORDED = '2026-10-17T07:42:00Z';
const CHANGED = '2026-10-18T01:05:00Z';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).every((token) => own.has(token));
}

function valueOf(term: string): HTMLElement {
  const dt = screen.getByText(term);
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement)) {
    throw new Error(`No value after ${term}`);
  }
  return dd;
}

describe('ActorName (SEC-08, D-11)', () => {
  it('renders the name as plain text with no suffix for a current colleague', () => {
    render(<ActorName actor={CARMEN} />);

    expect(screen.getByText('Carmen Reyes')).toBeInTheDocument();
    expect(screen.queryByText(/former staff/)).toBeNull();
  });

  it('adds a muted " (former staff)" after the name of a deleted colleague, never blank or unnamed', () => {
    const { container } = render(<ActorName actor={ANA} />);

    expect(container).toHaveTextContent('Ana Cruz (former staff)');
    const suffix = screen.getByText('(former staff)', { exact: false });
    expect(hasClasses(suffix, actorFormerClasses)).toBe(true);
    expect(screen.getByText('Ana Cruz', { exact: false })).toBeInTheDocument();
  });

  it('reads "System" with no suffix when there is no actor', () => {
    const { container } = render(<ActorName actor={null} />);

    expect(container).toHaveTextContent(/^System$/);
    expect(screen.queryByText(/former staff/)).toBeNull();
  });

  it('shows a name that looks like markup as text only (CWE-79)', () => {
    const { container } = render(<ActorName actor={{ name: '<img src=x onerror=alert(1)>', formerStaff: false }} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
});

describe('RecordMeta (SEC-08)', () => {
  function renderMeta(overrides: Partial<Parameters<typeof RecordMeta>[0]> = {}) {
    return render(
      <RecordMeta
        recordedBy={CARMEN}
        recordedAt={RECORDED}
        lastChangedBy={ANA}
        lastChangedAt={CHANGED}
        {...overrides}
      />,
    );
  }

  it('is a description list with "Recorded by" and "Last changed by", each name then " · " then the Manila time', () => {
    const { container } = renderMeta();

    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getAllByRole('term')).toHaveLength(2);
    expect(valueOf('Recorded by')).toHaveTextContent('Carmen Reyes · Oct 17, 2026, 3:42 PM');
    expect(valueOf('Last changed by')).toHaveTextContent('Ana Cruz (former staff) · Oct 18, 2026, 9:05 AM');
  });

  it('puts the time in a time element carrying the UTC instant', () => {
    renderMeta();

    const time = valueOf('Recorded by').querySelector('time');
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute('datetime', RECORDED);
    expect(time).toHaveTextContent('Oct 17, 2026, 3:42 PM');
  });

  it('reads "System" with no suffix for a record made before actors were recorded', () => {
    renderMeta({ recordedBy: null });

    expect(valueOf('Recorded by')).toHaveTextContent('System · Oct 17, 2026, 3:42 PM');
    expect(within(valueOf('Recorded by')).queryByText(/former staff/)).toBeNull();
  });

  it('shows EmptyValue for "Last changed by" on a record never changed: the minus icon and hidden "Not set"', () => {
    renderMeta({ lastChangedBy: null, lastChangedAt: null });

    const value = valueOf('Last changed by');
    expect(value.querySelector('time')).toBeNull();
    expect(value.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const hidden = within(value).getByText('Not set');
    expect(hasClasses(hidden, srOnlyClasses)).toBe(true);
    expect(value).not.toHaveTextContent('System');
  });

  it('stacks each term over its value at page widths up to 767, and uses the recipe looks', () => {
    const { container } = renderMeta();

    const list = container.querySelector('dl');
    expect(hasClasses(list, recordMetaClasses)).toBe(true);
    expect(list?.className).toContain('pg-phone:grid-cols-1');
    expect(list?.className).toContain('grid-cols-[max-content_1fr]');
    const term = screen.getByText('Recorded by');
    expect(hasClasses(term, recordMetaTermClasses)).toBe(true);
    expect(hasClasses(valueOf('Recorded by'), recordMetaValueClasses)).toBe(true);
    expect(hasClasses(term.parentElement, recordMetaRowClasses)).toBe(true);
  });

  it('shows no long dash anywhere (OR-4)', () => {
    const { container } = renderMeta({ lastChangedBy: null, lastChangedAt: null });

    expect(container.textContent).not.toMatch(new RegExp('[\u2013\u2014]'));
  });

  it('has no axe violations', async () => {
    const { container } = renderMeta();

    await expectNoAxeViolations(container);
  });
});
