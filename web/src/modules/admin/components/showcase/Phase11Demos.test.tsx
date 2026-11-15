// Phase 11 demos in the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions"; plan 11-37): PhotoSlot in its five
// states, PhoneNumbersField with one row, four rows and the main number moved, and the Public website card of an order in its five
// states, all on made-up data. No test here may cause a request: the demos hold their own data and send nothing.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { Phase11Demos } from './Phase11Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase11Demos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

/** Every case of the section, in the order the page shows them. */
const CASE_IDS = [
  'site-content-photo-slot-empty',
  'site-content-photo-slot-uploading',
  'site-content-photo-slot-saved',
  'site-content-photo-slot-error',
  'site-content-photo-slot-with-photo',
  'site-content-phone-numbers-one',
  'site-content-phone-numbers-four',
  'site-content-phone-numbers-main-moved',
  'public-website-card-no-ok',
  'public-website-card-ok-not-shown',
  'public-website-card-shown',
  'public-website-card-shown-no-photo',
  'public-website-card-cancelled',
];

// The section holds thirteen frames and axe runs over all of them: a busy machine needs more than the 5 s default.
vi.setConfig({ testTimeout: 30_000 });

const requests: string[] = [];
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  server.events.removeAllListeners();
  fetchSpy.mockRestore();
});

describe('Phase11Demos: the page', () => {
  it('draws the thirteen cases in order, each in its own labelled frame', () => {
    renderDemos();

    const ids = [...document.querySelectorAll('[data-case]')].map((frame) => frame.getAttribute('data-case'));
    expect(ids).toEqual(CASE_IDS);
  });

  it('has no axe finding in any state', async () => {
    const view = renderDemos();

    await expectNoAxeViolations(view.container);
  });

  it('sends no request and reads nothing, even when every button is pressed', async () => {
    renderDemos();
    const user = userEvent.setup();

    for (const button of screen.getAllByRole('button')) {
      await user.click(button);
    }

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase11Demos: PhotoSlot', () => {
  it('shows an empty slot with Choose Photo and no status', () => {
    renderDemos();
    const slot = within(caseFrame('site-content-photo-slot-empty'));

    expect(slot.getByRole('group', { name: 'Main photo' })).toBeInTheDocument();
    expect(slot.getByRole('button', { name: 'Choose Photo' })).toBeInTheDocument();
    expect(slot.getByRole('status')).toBeEmptyDOMElement();
    expect(slot.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an upload in progress: the status says Uploading and the other buttons wait', () => {
    renderDemos();
    const slot = within(caseFrame('site-content-photo-slot-uploading'));

    expect(slot.getByRole('status')).toHaveTextContent('Uploading');
    expect(slot.getByRole('button', { name: 'Take Photo' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a saved photo: the status says Saved', () => {
    renderDemos();
    const slot = within(caseFrame('site-content-photo-slot-saved'));

    expect(slot.getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows a refused file with its name and the reason in an alert', () => {
    renderDemos();
    const slot = within(caseFrame('site-content-photo-slot-error'));

    expect(slot.getByRole('alert')).toHaveTextContent('front-view.heic');
    expect(slot.getByRole('alert')).toHaveTextContent('The limit is 10 MB.');
  });

  it('shows a slot with a photo: the preview, Replace Photo and Remove Photo', () => {
    renderDemos();
    const slot = within(caseFrame('site-content-photo-slot-with-photo'));

    expect(slot.getByRole('button', { name: 'Replace Photo' })).toBeInTheDocument();
    expect(slot.getByRole('button', { name: 'Remove Photo' })).toBeInTheDocument();
    expect(slot.queryByRole('button', { name: 'Choose Photo' })).not.toBeInTheDocument();
  });
});

describe('Phase11Demos: PhoneNumbersField', () => {
  it('shows one row with its Main number selected and Add Number', () => {
    renderDemos();
    const field = within(caseFrame('site-content-phone-numbers-one'));

    expect(field.getAllByLabelText(/^Number/)).toHaveLength(1);
    expect(field.getByRole('radio', { name: /^Main number/ })).toBeChecked();
    expect(field.getByRole('button', { name: 'Add Number' })).toBeInTheDocument();
  });

  it('shows four rows, no Add Number and the limit note', () => {
    renderDemos();
    const field = within(caseFrame('site-content-phone-numbers-four'));

    expect(field.getAllByLabelText(/^Number/)).toHaveLength(4);
    expect(field.queryByRole('button', { name: 'Add Number' })).not.toBeInTheDocument();
    expect(field.getByText('You can list up to 4 numbers.')).toBeInTheDocument();
  });

  it('shows the main number moved to the second row', () => {
    renderDemos();
    const field = within(caseFrame('site-content-phone-numbers-main-moved'));
    const radios = field.getAllByRole('radio', { name: /^Main number/ });

    expect(radios).toHaveLength(2);
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });
});

describe('Phase11Demos: the Public website card', () => {
  it('shows an order with no customer OK: Customer OK No and Not shown', () => {
    renderDemos();
    const card = within(caseFrame('public-website-card-no-ok'));

    expect(card.getByRole('heading', { name: 'Public website' })).toBeInTheDocument();
    expect(card.getByText('No')).toBeInTheDocument();
    expect(card.getByText('Not shown')).toBeInTheDocument();
  });

  it('shows an order with the OK recorded but not shown', () => {
    renderDemos();
    const card = within(caseFrame('public-website-card-ok-not-shown'));

    expect(card.getByText('Yes, recorded Oct 6, 2026 by Liza Mercado')).toBeInTheDocument();
    expect(card.getByText('Not shown')).toBeInTheDocument();
  });

  it('shows a shown order with its line, its name and the date it went up', () => {
    renderDemos();
    const card = within(caseFrame('public-website-card-shown'));

    expect(card.getByText('Shown')).toBeInTheDocument();
    expect(card.getByText(/since Oct 7, 2026/)).toBeInTheDocument();
    expect(card.getByText('Basketball Jerseys')).toBeInTheDocument();
    expect(card.queryByText('It shows once the order has a photo.')).not.toBeInTheDocument();
  });

  it('shows a shown order that has no photo yet with the note that it waits for one', () => {
    renderDemos();
    const card = within(caseFrame('public-website-card-shown-no-photo'));

    expect(card.getByText('Shown')).toBeInTheDocument();
    expect(card.getByText('It shows once the order has a photo.')).toBeInTheDocument();
  });

  it('shows a Cancelled order with the note and no Edit button', () => {
    renderDemos();
    const card = within(caseFrame('public-website-card-cancelled'));

    expect(card.getByText("Cancelled orders can't be shown on the website.")).toBeInTheDocument();
    expect(card.queryByRole('button', { name: 'Edit public website settings' })).not.toBeInTheDocument();
  });

  it('does not open the window when Edit is pressed: a demo case opens nothing', async () => {
    renderDemos();
    const user = userEvent.setup();

    await user.click(
      within(caseFrame('public-website-card-no-ok')).getByRole('button', { name: 'Edit public website settings' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
