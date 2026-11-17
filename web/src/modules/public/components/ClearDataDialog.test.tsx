// CS2, the clear confirmation (ANL-04, D-19, D-35, D-41): a ConfirmDialog whose confirm runs the server call first and clears
// this browser only after it answers 2xx.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { consentCookie, demoDecision, setConsent } from '@/test/consentFixtures';
import { server } from '@/test/msw';
import { ClearDataDialog } from './ClearDataDialog';

const TITLE = 'Clear your cookies and data?';
const MESSAGE =
  "This deletes this site's cookies and saved settings in this browser, and the visit records linked to them on our server. This can't be undone.";
const FAILED = "Couldn't clear your data. Check your internet connection and try again.";
const THROTTLED = 'Too many tries. Wait a minute and try again.';

const answered = { ...demoDecision, stats: false, map: false };

function renderDialog() {
  const onCleared = vi.fn();
  const onCancel = vi.fn();
  render(<ClearDataDialog onCleared={onCleared} onCancel={onCancel} />);
  return { onCleared, onCancel };
}

/** An answer that waits until the test lets it go, so the pending state can be inspected. */
function gatedClear() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  server.use(
    http.post('*/api/v1/analytics/clear', async () => {
      calls += 1;
      await gate;
      return HttpResponse.json(answered);
    }),
  );
  return { release, calls: () => calls };
}

beforeEach(() => {
  setConsent({ cookie: consentCookie({ stats: true, map: true }) });
  localStorage.setItem('csps-admin-theme', 'espresso');
  sessionStorage.setItem('orders-view', 'cards');
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('the dialog (UI-SPEC CS2, D-35)', () => {
  it('asks in the UI-SPEC words and starts with focus on Keep My Data', async () => {
    renderDialog();

    const dialog = await screen.findByRole('dialog', { name: TITLE });
    expect(within(dialog).getByText(MESSAGE)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Clear My Data' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep My Data' })).toHaveFocus();
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('Keep My Data and Esc ask to close and send nothing', async () => {
    let sent = 0;
    server.use(
      http.post('*/api/v1/analytics/clear', () => {
        sent += 1;
        return HttpResponse.json(answered);
      }),
    );
    const { onCancel, onCleared } = renderDialog();
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Keep My Data' }));
    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onCleared).not.toHaveBeenCalled();
    expect(sent).toBe(0);
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
  });

  it('keeps the two buttons stacked and 44px tall on a narrow phone, and lets the text wrap', async () => {
    renderDialog();
    const dialog = await screen.findByRole('dialog', { name: TITLE });
    const keep = within(dialog).getByRole('button', { name: 'Keep My Data' });
    const clear = within(dialog).getByRole('button', { name: 'Clear My Data' });

    // jsdom has no layout: the footer's wrap and fill classes and the md button height are what make this at 320px.
    const footer = dialog.querySelector('footer');
    expect(footer).toHaveClass('flex-wrap', 'vp-lt-sm:*:flex-1');
    expect(keep).toHaveClass('h-11');
    expect(clear).toHaveClass('h-11');
    expect(within(dialog).getByText(MESSAGE).parentElement).toHaveClass('min-w-0');
  });
});

describe('confirming (D-19, D-31, D-41)', () => {
  it('runs the server call first, then clears this browser, then tells its owner once', async () => {
    let seenLocal: string | null = null;
    server.use(
      http.post('*/api/v1/analytics/clear', () => {
        seenLocal = localStorage.getItem('csps-admin-theme');
        return HttpResponse.json(answered);
      }),
    );
    const { onCleared } = renderDialog();
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));

    await waitFor(() => {
      expect(onCleared).toHaveBeenCalledTimes(1);
    });
    expect(seenLocal).toBe('espresso');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows Clearing while the call runs, and Esc and Keep My Data wait', async () => {
    const gate = gatedClear();
    const { onCancel, onCleared } = renderDialog();
    const dialog = await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));

    const pending = await within(dialog).findByRole('button', { name: 'Clearing' });
    expect(pending).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep My Data' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');

    gate.release();
    await waitFor(() => {
      expect(onCleared).toHaveBeenCalledTimes(1);
    });
    expect(gate.calls()).toBe(1);
  });

  it('sends one call however many times Clear My Data is pressed', async () => {
    const gate = gatedClear();
    renderDialog();
    await screen.findByRole('dialog', { name: TITLE });
    const button = screen.getByRole('button', { name: 'Clear My Data' });

    await userEvent.click(button);
    await userEvent.click(button);
    gate.release();

    await waitFor(() => {
      expect(localStorage.length).toBe(0);
    });
    expect(gate.calls()).toBe(1);
  });
});

describe('when the call fails (UI-SPEC error)', () => {
  it('a network failure clears nothing, keeps the dialog open and says so', async () => {
    server.use(http.post('*/api/v1/analytics/clear', () => HttpResponse.error()));
    const { onCleared } = renderDialog();
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument();
    expect(onCleared).not.toHaveBeenCalled();
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
    expect(sessionStorage.getItem('orders-view')).toBe('cards');
    expect(screen.getByRole('button', { name: 'Clear My Data' })).toBeEnabled();
  });

  it('a server error says the same and can be tried again', async () => {
    let answerOk = false;
    server.use(
      http.post('*/api/v1/analytics/clear', () =>
        answerOk ? HttpResponse.json(answered) : HttpResponse.json({ title: 'Failed', status: 500 }, { status: 500 }),
      ),
    );
    const { onCleared } = renderDialog();
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(FAILED);
    answerOk = true;
    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));

    await waitFor(() => {
      expect(onCleared).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.length).toBe(0);
  });

  it('a 429 shows the wait-a-minute line and clears nothing', async () => {
    server.use(
      http.post('*/api/v1/analytics/clear', () =>
        HttpResponse.json({ title: THROTTLED, status: 429, code: 'rate-limited' }, { status: 429 }),
      ),
    );
    const { onCleared } = renderDialog();
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(THROTTLED);
    expect(onCleared).not.toHaveBeenCalled();
    expect(localStorage.getItem('csps-admin-theme')).toBe('espresso');
  });
});

describe('accessibility', () => {
  it('has no axe violations open, pending and failed', async () => {
    const gate = gatedClear();
    const { container } = render(<ClearDataDialog onCleared={vi.fn()} onCancel={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: TITLE });
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));
    await within(dialog).findByRole('button', { name: 'Clearing' });
    await expectNoAxeViolations(container);
    gate.release();
  });

  it('has no axe violations in the failed state', async () => {
    server.use(http.post('*/api/v1/analytics/clear', () => HttpResponse.error()));
    const { container } = render(<ClearDataDialog onCleared={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByRole('dialog', { name: TITLE });

    await userEvent.click(screen.getByRole('button', { name: 'Clear My Data' }));
    await screen.findByRole('alert');

    await expectNoAxeViolations(container);
  });
});
