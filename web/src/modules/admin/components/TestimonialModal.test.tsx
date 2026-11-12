import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { TestimonialModal } from '@/modules/admin/components/TestimonialModal';
import type { Testimonial } from '@/modules/admin/services/testimonialsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoTestimonials, problemAnswer, testimonialsBackend } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S5 TestimonialModal (CONT-03, OR-3, D-05; plan 11-24): add and edit one testimonial with the approved rules and words.

vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

interface Props {
  testimonial?: Testimonial;
  onClose?: () => void;
  onSaved?: (saved: Testimonial) => void;
}

function renderModal({ testimonial, onClose = vi.fn(), onSaved = vi.fn() }: Props = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {testimonial === undefined ? (
          <TestimonialModal mode="add" onClose={onClose} onSaved={onSaved} />
        ) : (
          <TestimonialModal mode="edit" testimonial={testimonial} onClose={onClose} onSaved={onSaved} />
        )}
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup(), onClose, onSaved };
}

const quote = (): HTMLTextAreaElement => screen.getByLabelText(/^Quote/);
const name = (): HTMLInputElement => screen.getByLabelText(/^Name/);
const team = (): HTMLInputElement => screen.getByLabelText(/^Team or role/);
const show = (): HTMLInputElement => screen.getByRole('checkbox', { name: 'Show on the website' });
const save = (): HTMLElement => screen.getByRole('button', { name: 'Save Testimonial' });

function pick(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

describe('the add window', () => {
  it('has the title, the four fields with their hint and placeholder, the Stars group and the Cancel and Save Testimonial buttons', async () => {
    testimonialsBackend();
    renderModal();

    expect(await screen.findByRole('dialog', { name: 'Add Testimonial' })).toBeVisible();
    expect(quote()).toBeVisible();
    expect(quote()).toHaveAttribute('rows', '4');
    expect(screen.getByText('Write it the way the customer said it.')).toBeVisible();
    expect(name()).toBeVisible();
    expect(team()).toHaveAttribute('placeholder', 'e.g. Captain, Brgy. San Roque Ballers');
    const group = screen.getByRole('group', { name: 'Stars' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['5', '4', '3', '2', '1']);
    expect(within(group).getByRole('radio', { name: '5 stars' })).toBeVisible();
    expect(within(group).getByRole('radio', { name: '1 star' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(save()).toBeVisible();
  });

  it('starts with 5 stars chosen and Show on the website ticked', async () => {
    testimonialsBackend();
    renderModal();

    expect(await screen.findByRole('radio', { name: '5 stars' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '4 stars' })).not.toBeChecked();
    expect(show()).toBeChecked();
  });

  it('shows "Enter the quote." when the empty Quote is left, and sends nothing on Save', async () => {
    const backend = testimonialsBackend();
    const { user } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });

    await user.click(quote());
    await user.tab();
    expect(await screen.findByText('Enter the quote.')).toBeVisible();
    pick(name(), 'Ana Reyes');
    await user.click(save());

    expect(quote()).toHaveFocus();
    expect(quote()).toHaveAttribute('aria-invalid', 'true');
    expect(backend.posts).toHaveLength(0);
  });

  it('shows "Keep the quote to 300 characters or fewer." for 301 characters and takes exactly 300', async () => {
    const backend = testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    pick(name(), 'Ana Reyes');
    pick(quote(), 'a'.repeat(301));

    await user.click(save());

    expect(await screen.findByText('Keep the quote to 300 characters or fewer.')).toBeVisible();
    expect(backend.posts).toHaveLength(0);
    pick(quote(), 'a'.repeat(300));
    await user.click(save());
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.posts[0]?.body.quote).toBe('a'.repeat(300));
  });

  it('shows "Enter the name." and "Keep the name to 60 characters or fewer." and "Keep this to 80 characters or fewer."', async () => {
    const backend = testimonialsBackend();
    const { user } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    pick(quote(), 'Great jerseys.');

    await user.click(save());
    expect(await screen.findByText('Enter the name.')).toBeVisible();
    expect(name()).toHaveFocus();

    pick(name(), 'a'.repeat(61));
    pick(team(), 'b'.repeat(81));
    await user.click(save());
    expect(await screen.findByText('Keep the name to 60 characters or fewer.')).toBeVisible();
    expect(screen.getByText('Keep this to 80 characters or fewer.')).toBeVisible();
    expect(backend.posts).toHaveLength(0);
  });

  it('sends POST with the checked values and one Idempotency-Key, shows the toast, hands the testimonial on and closes', async () => {
    const backend = testimonialsBackend();
    const { user, onSaved, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    pick(quote(), '  Great jerseys, on time.  ');
    pick(name(), ' Ana Reyes ');

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.body).toEqual({
      quote: 'Great jerseys, on time.',
      name: 'Ana Reyes',
      teamOrRole: null,
      stars: 5,
      isShown: true,
      version: null,
    });
    expect(backend.posts[0]?.key).toMatch(/\S/);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Reyes', isShown: true }));
    expect(await screen.findByText('Testimonial added')).toBeVisible();
    expect(screen.getByText('The Home page shows the change.')).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('sends the stars that were chosen and a hidden testimonial when Show on the website is unticked', async () => {
    const backend = testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    pick(quote(), 'Fine.');
    pick(name(), 'Ben Santos');
    pick(team(), 'President');
    await user.click(screen.getByRole('radio', { name: '3 stars' }));
    await user.click(show());

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.posts[0]?.body).toMatchObject({ stars: 3, isShown: false, teamOrRole: 'President' });
  });

  it("puts the server's message under Quote, keeps the window open and focuses Quote", async () => {
    testimonialsBackend(undefined, {
      onPost: () => problemAnswer(400, { errors: { quote: ['Enter the quote.'] } }),
    });
    const { user, onClose, onSaved } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    pick(quote(), 'Typed text');
    pick(name(), 'Ana Reyes');

    await user.click(save());

    expect(await screen.findByText('Enter the quote.')).toBeVisible();
    expect(quote()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    testimonialsBackend();
    const { baseElement } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });

    await expectNoAxeViolations(baseElement);
  });
});

describe('the discard guard (08 D-58)', () => {
  it('closes a window nobody changed at once', async () => {
    testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('asks "Discard changes?" before closing a changed window, and Keep Editing leaves it open', async () => {
    testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    await user.type(quote(), 'Half a thought');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    const question = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(question).getByRole('button', { name: 'Keep Editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(quote()).toHaveValue('Half a thought');
  });

  it('closes on Discard Changes', async () => {
    testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    await user.type(name(), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const question = await screen.findByRole('dialog', { name: 'Discard changes?' });

    await user.click(within(question).getByRole('button', { name: 'Discard Changes' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('counts a changed star or a changed tick as a change', async () => {
    testimonialsBackend();
    const { user, onClose } = renderModal();
    await screen.findByRole('dialog', { name: 'Add Testimonial' });
    await user.click(screen.getByRole('radio', { name: '2 stars' }));

    await user.keyboard('{Escape}');

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('the edit window', () => {
  const [juan] = demoTestimonials();
  if (juan === undefined) {
    throw new Error('The demo testimonials are empty.');
  }
  const longQuote = 'Q'.repeat(300);
  const long: Testimonial = { ...juan, quote: longQuote };

  it('opens with the title, the saved values, the whole 300-character quote and the saved stars', async () => {
    testimonialsBackend();
    renderModal({ testimonial: { ...long, stars: 4 } });

    expect(await screen.findByRole('dialog', { name: 'Edit Testimonial' })).toBeVisible();
    expect(quote()).toHaveValue(longQuote);
    expect(name()).toHaveValue('Juan Dela Cruz');
    expect(team()).toHaveValue('Captain, Brgy. Sample Ballers');
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
    expect(show()).toBeChecked();
  });

  it('shows a hidden testimonial with Show on the website unticked', async () => {
    const hidden = demoTestimonials()[3];
    testimonialsBackend();
    renderModal(hidden === undefined ? {} : { testimonial: hidden });

    expect(await screen.findByRole('dialog', { name: 'Edit Testimonial' })).toBeVisible();
    expect(show()).not.toBeChecked();
    expect(team()).toHaveValue('');
  });

  it('sends PUT with the version it opened with and says Testimonial saved', async () => {
    const backend = testimonialsBackend();
    const { user, onSaved } = renderModal({ testimonial: juan });
    pick(quote(), 'Seventeen pieces, all perfect.');

    await user.click(save());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts).toEqual([
      {
        id: juan.id,
        body: {
          quote: 'Seventeen pieces, all perfect.',
          name: 'Juan Dela Cruz',
          teamOrRole: 'Captain, Brgy. Sample Ballers',
          stars: 5,
          isShown: true,
          version: juan.version,
        },
      },
    ]);
    expect(await screen.findByText('Testimonial saved')).toBeVisible();
    expect(screen.getByText('The Home page shows the change.')).toBeVisible();
  });

  it('on a stale save keeps the typed values behind the conflict banner, and Load Latest shows their words and uses the new version', async () => {
    const backend = testimonialsBackend([juan], {
      onPut: (_id, _body, current) => {
        if (current.puts.length > 1) {
          return undefined;
        }
        current.items = [{ ...juan, quote: 'Their words', version: 'AAAAAAAAG88=' }];
        return problemAnswer(409, { code: 'edit.stale' });
      },
    });
    const { user, onSaved } = renderModal({ testimonial: juan });
    pick(quote(), 'My words');

    await user.click(save());

    expect(await screen.findByText('This was changed by someone else.')).toBeVisible();
    expect(quote()).toHaveValue('My words');

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(quote()).toHaveValue('Their words');
    });
    await user.click(save());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts[1]?.body.version).toBe('AAAAAAAAG88=');
  });

  it('says the testimonial was not found when it was deleted meanwhile', async () => {
    testimonialsBackend([juan], { onPut: () => problemAnswer(404, { code: 'testimonials.not-found' }) });
    const { user, onClose } = renderModal({ testimonial: juan });
    pick(quote(), 'Changed');

    await user.click(save());

    expect(await screen.findByText("This testimonial wasn't found. It may have been deleted.")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});
