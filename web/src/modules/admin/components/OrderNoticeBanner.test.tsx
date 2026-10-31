import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/actions';
import { OrderNoticeBanner } from '@/modules/admin/components/OrderNoticeBanner';
import { expectNoAxeViolations } from '@/test/axe';

// The banner under a header that tells the person something about the whole order (UI-SPEC X2; plan 08-23).

describe('OrderNoticeBanner', () => {
  it('shows a bold line, a muted line and the actions after them', () => {
    render(
      <OrderNoticeBanner icon="archive" title="This order was deleted." message="It counts nowhere.">
        <Button>Restore Order</Button>
      </OrderNoticeBanner>,
    );

    expect(screen.getByText('This order was deleted.').tagName).toBe('STRONG');
    expect(screen.getByText('It counts nowhere.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore Order' })).toBeVisible();
  });

  it('draws its icon for the eye only, so the text is the whole announcement', () => {
    const { container } = render(<OrderNoticeBanner icon="archive" title="Title" message="Message" />);

    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no action area without actions', () => {
    const { container } = render(<OrderNoticeBanner icon="archive" title="Title" message="Message" />);

    expect(container.querySelector('button')).toBeNull();
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('takes a title made of parts, such as text and a name', () => {
    render(
      <OrderNoticeBanner
        icon="archive"
        title={
          <>
            Deleted by <em>Carmen Reyes</em>.
          </>
        }
        message="Message"
      />,
    );

    expect(screen.getByText('Carmen Reyes')).toBeVisible();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <OrderNoticeBanner icon="archive" title="Title" message="Message">
        <Button>Restore Order</Button>
      </OrderNoticeBanner>,
    );

    await expectNoAxeViolations(container);
  });
});
