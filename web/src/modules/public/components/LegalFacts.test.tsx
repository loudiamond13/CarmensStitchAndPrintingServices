// SPEC-GAP: LEGAL-04, D-11, D-12, D-13, D-29. LegalFacts in every state: loading, failed, populated, with a value missing and with
// long text (UI-SPEC L1 item 3 and the UI Considerations rows for LegalFacts).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { expectNoAxeViolations } from '@/test/axe';
import { inStrictMode } from '@/test/strictMode';
import { server } from '@/test/msw';
import {
  answerSite,
  demoSite,
  privacyContactFailureHandler,
  privacyContactHandler,
  siteFailureHandler,
  siteWithoutOptionals,
} from '@/test/publicFixtures';
import { LegalFacts, type LegalFactsPart } from './LegalFacts';

const EMAIL = 'shop-private@example.test';

function renderFacts(show: readonly LegalFactsPart[]) {
  return render(<LegalFacts show={show} />);
}

/** A read that never answers, so the block stays in its loading state. */
const never = () => delay('infinite');

describe('LegalFacts loading and failure (UI-SPEC L1 item 3)', () => {
  it('shows three skeleton lines, hidden from assistive technology, while the site read is pending', () => {
    server.use(http.get('*/api/v1/public/site', never));
    const { container } = renderFacts(['business', 'contact']);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).not.toBeNull();
    expect(skeleton?.children).toHaveLength(3);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the skeleton while the contact read is pending, even when the site has answered', async () => {
    server.use(http.get('*/api/v1/public/privacy-contact', never));
    const { container } = renderFacts(['contact']);
    await waitFor(() => {
      expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(3);
    });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the error banner with Try Again when the site read fails', async () => {
    server.use(siteFailureHandler());
    renderFacts(['business', 'contact']);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't load our contact details.")).toBeInTheDocument();
    expect(within(alert).getByText('Check your internet connection and try again.')).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows the error banner when the contact read fails', async () => {
    server.use(privacyContactFailureHandler());
    renderFacts(['contact']);
    expect(await screen.findByText("Couldn't load our contact details.")).toBeInTheDocument();
  });

  it('retries both reads with Try Again and then shows the lines', async () => {
    let siteReads = 0;
    let contactReads = 0;
    let healthy = false;
    server.use(
      http.get('*/api/v1/public/site', () => {
        siteReads += 1;
        return healthy ? HttpResponse.json(demoSite) : HttpResponse.json({ title: 'x', status: 500 }, { status: 500 });
      }),
      http.get('*/api/v1/public/privacy-contact', () => {
        contactReads += 1;
        return healthy
          ? HttpResponse.json({ email: EMAIL })
          : HttpResponse.json({ title: 'x', status: 500 }, { status: 500 });
      }),
    );
    renderFacts(['contact']);
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    const before = { site: siteReads, contact: contactReads };
    healthy = true;
    await userEvent.click(retry);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    expect(siteReads).toBeGreaterThan(before.site);
    expect(contactReads).toBeGreaterThan(before.contact);
  });

  it('has zero axe violations while loading and when failed', async () => {
    server.use(http.get('*/api/v1/public/site', never));
    const loading = renderFacts(['contact']);
    await expectNoAxeViolations(loading.container);
    loading.unmount();

    server.use(siteFailureHandler());
    const failed = renderFacts(['contact']);
    await screen.findByRole('alert');
    await expectNoAxeViolations(failed.container);
  });
});

describe('LegalFacts populated (D-11, D-12, D-13, D-29)', () => {
  it('shows the business name and the address from the site settings, nothing hard-coded', async () => {
    renderFacts(['business']);
    expect(await screen.findByText('Sample Shop')).toBeInTheDocument();
    expect(screen.getByText('12 Sample St., Poblacion, Sample City, Sample Province, Philippines')).toBeInTheDocument();
  });

  it('shows the Data Protection Officer line for dpo, without waiting for any read', () => {
    server.use(http.get('*/api/v1/public/site', never), http.get('*/api/v1/public/privacy-contact', never));
    renderFacts(['dpo']);
    expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
  });

  it('shows the Email, Messenger and Phone lines, each with its link', async () => {
    renderFacts(['contact']);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((item) => item.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      `Email: ${EMAIL}`,
      'Messenger: Message us on Messenger (opens in a new tab)',
      'Phone: 0917 123 4567',
    ]);
    expect(screen.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`);
    expect(screen.getByRole('link', { name: /^Message us on Messenger/ })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(screen.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });

  it('shows the main phone when two are listed', async () => {
    renderFacts(['contact']);
    expect(await screen.findByRole('link', { name: '0917 123 4567' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '02 8123 4567' })).not.toBeInTheDocument();
  });

  it('shows the parts in the order asked', async () => {
    const { container } = renderFacts(['business', 'dpo', 'contact']);
    await screen.findByRole('link', { name: EMAIL });
    const text = container.textContent;
    expect(text.indexOf('Sample Shop')).toBeLessThan(text.indexOf('Data Protection Officer'));
    expect(text.indexOf('Data Protection Officer')).toBeLessThan(text.indexOf('Email:'));
  });

  it('has zero axe violations when populated', async () => {
    const { container } = renderFacts(['business', 'dpo', 'contact']);
    await screen.findByRole('link', { name: EMAIL });
    await expectNoAxeViolations(container);
  });
});

describe('LegalFacts with a value missing (UI-SPEC empty row)', () => {
  it('leaves out the Email line when no email is stored and keeps Messenger and Phone', async () => {
    server.use(privacyContactHandler(null));
    renderFacts(['contact']);
    expect(await screen.findByText('Messenger:')).toBeInTheDocument();
    expect(screen.getByText('Phone:')).toBeInTheDocument();
    expect(screen.queryByText('Email:')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('treats a blank stored email as none', async () => {
    server.use(privacyContactHandler('   '));
    renderFacts(['contact']);
    await screen.findByText('Phone:');
    expect(screen.queryByText('Email:')).not.toBeInTheDocument();
  });

  it('leaves out Messenger and Phone when neither is set and keeps Email', async () => {
    answerSite({ ...siteWithoutOptionals, phones: [] });
    renderFacts(['contact']);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Messenger:')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone:')).not.toBeInTheDocument();
  });

  it('shows nothing at all, and no bracket or dash, when no contact value is set', async () => {
    server.use(privacyContactHandler(null));
    answerSite({ ...siteWithoutOptionals, phones: [] });
    const { container } = renderFacts(['contact']);
    await waitFor(() => {
      expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    });
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('has zero axe violations with a value missing', async () => {
    server.use(privacyContactHandler(null));
    const { container } = renderFacts(['business', 'contact']);
    await screen.findByText('Phone:');
    await expectNoAxeViolations(container);
  });
});

describe('LegalFacts business part with a value missing', () => {
  it('shows only the address when the name is blank', async () => {
    answerSite({ ...demoSite, businessName: '   ' });
    renderFacts(['business']);
    expect(
      await screen.findByText('12 Sample St., Poblacion, Sample City, Sample Province, Philippines'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('paragraph')).toHaveLength(1);
  });

  it('shows only the name when no address part is set', async () => {
    answerSite({ ...demoSite, address: { street: null, townOrCity: null, province: null, postalCode: null } });
    renderFacts(['business']);
    expect(await screen.findByText('Sample Shop')).toBeInTheDocument();
    expect(screen.getAllByRole('paragraph')).toHaveLength(1);
    expect(screen.queryByText(/Philippines/)).not.toBeInTheDocument();
  });

  it('shows nothing when neither the name nor the address is set', async () => {
    answerSite({
      ...demoSite,
      businessName: '',
      address: { street: null, townOrCity: null, province: null, postalCode: null },
    });
    const { container } = renderFacts(['business']);
    await waitFor(() => {
      expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    });
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});

describe('LegalFacts contact part with one line only', () => {
  it('shows only Messenger when there is no email and no phone', async () => {
    server.use(privacyContactHandler(null));
    answerSite({ ...demoSite, phones: [] });
    renderFacts(['contact']);
    expect(await screen.findByText('Messenger:')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows only Phone when there is no email and no Messenger link', async () => {
    server.use(privacyContactHandler(null));
    answerSite({ ...siteWithoutOptionals });
    renderFacts(['contact']);
    expect(await screen.findByRole('link', { name: '0917 123 4567' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('dials the first listed number when none is marked main', async () => {
    answerSite({
      ...siteWithoutOptionals,
      phones: [{ display: '0918 000 0000', e164: '+639180000000', label: null, isMain: false }],
    });
    renderFacts(['contact']);
    expect(await screen.findByRole('link', { name: '0918 000 0000' })).toHaveAttribute('href', 'tel:+639180000000');
  });
});

describe('LegalFacts retry and changing parts', () => {
  it('retries only the read that failed when the site read fails', async () => {
    let siteReads = 0;
    let contactReads = 0;
    let healthy = false;
    server.use(
      http.get('*/api/v1/public/site', () => {
        siteReads += 1;
        return healthy ? HttpResponse.json(demoSite) : HttpResponse.json({ title: 'x', status: 500 }, { status: 500 });
      }),
      http.get('*/api/v1/public/privacy-contact', () => {
        contactReads += 1;
        return HttpResponse.json({ email: EMAIL });
      }),
    );
    renderFacts(['contact']);
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    const before = { site: siteReads, contact: contactReads };
    healthy = true;
    await userEvent.click(retry);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    expect(siteReads).toBeGreaterThan(before.site);
    expect(contactReads).toBe(before.contact);
  });

  it('retries only the read that failed when the contact read fails', async () => {
    let siteReads = 0;
    let contactReads = 0;
    let healthy = false;
    server.use(
      http.get('*/api/v1/public/site', () => {
        siteReads += 1;
        return HttpResponse.json(demoSite);
      }),
      http.get('*/api/v1/public/privacy-contact', () => {
        contactReads += 1;
        return healthy
          ? HttpResponse.json({ email: EMAIL })
          : HttpResponse.json({ title: 'x', status: 500 }, { status: 500 });
      }),
    );
    renderFacts(['contact']);
    const retry = await screen.findByRole('button', { name: 'Try Again' });
    const before = { site: siteReads, contact: contactReads };
    healthy = true;
    await userEvent.click(retry);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    expect(contactReads).toBeGreaterThan(before.contact);
    expect(siteReads).toBe(before.site);
  });

  it('follows the parts it is asked for on a rerender, from the dpo line to the shop facts', async () => {
    const { rerender } = renderFacts(['dpo']);
    expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
    rerender(<LegalFacts show={['dpo']} />);
    expect(screen.getAllByRole('paragraph')).toHaveLength(1);

    rerender(<LegalFacts show={['business', 'dpo']} />);
    expect(await screen.findByText('Sample Shop')).toBeInTheDocument();
    expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
    expect(screen.queryByText('Email:')).not.toBeInTheDocument();

    rerender(<LegalFacts show={['contact']} />);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    expect(screen.queryByText('Sample Shop')).not.toBeInTheDocument();
  });

  it('shows the Messenger link as an external link with the hidden suffix', async () => {
    renderFacts(['contact']);
    const link = await screen.findByRole('link', { name: /^Message us on Messenger/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('LegalFacts with long text (UI-SPEC long-text row)', () => {
  const longName = `Name${'x'.repeat(116)}`;
  const longStreet = `Street${'y'.repeat(114)}`;

  it('wraps a 120 character name and address instead of cutting them off or scrolling sideways', async () => {
    answerSite({ ...demoSite, businessName: longName, address: { ...demoSite.address, street: longStreet } });
    const { container } = renderFacts(['business', 'contact']);
    const name = await screen.findByText(longName);
    expect(name.closest('[class*="wrap-anywhere"]')).not.toBeNull();
    const address = screen.getByText(new RegExp(`^${longStreet}`));
    expect(address.closest('[class*="wrap-anywhere"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('wraps a long email address', async () => {
    const longEmail = `${'z'.repeat(80)}@example.test`;
    server.use(privacyContactHandler(longEmail));
    renderFacts(['contact']);
    const link = await screen.findByRole('link', { name: longEmail });
    expect(link.closest('[class*="wrap-anywhere"]')).not.toBeNull();
  });
});

describe('LegalFacts when the content changes while it shows', () => {
  it('shows a changed email and keeps the Messenger and Phone lines', async () => {
    renderFacts(['contact']);
    expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
    server.use(privacyContactHandler('new-private@example.test'));
    act(() => {
      invalidatePublicContent();
    });
    expect(await screen.findByRole('link', { name: 'new-private@example.test' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: EMAIL })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0917 123 4567' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('drops the email line when the stored email is removed', async () => {
    renderFacts(['contact']);
    await screen.findByRole('link', { name: EMAIL });
    server.use(privacyContactHandler(null));
    act(() => {
      invalidatePublicContent();
    });
    await waitFor(() => {
      expect(screen.queryByText('Email:')).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows a changed phone and Messenger link and keeps the email', async () => {
    renderFacts(['contact']);
    await screen.findByRole('link', { name: EMAIL });
    answerSite({
      ...demoSite,
      messengerUrl: 'https://m.me/another',
      phones: [{ display: '0999 888 7777', e164: '+639998887777', label: null, isMain: true }],
    });
    act(() => {
      invalidatePublicContent();
    });
    expect(await screen.findByRole('link', { name: '0999 888 7777' })).toHaveAttribute('href', 'tel:+639998887777');
    expect(screen.getByRole('link', { name: /^Message us on Messenger/ })).toHaveAttribute(
      'href',
      'https://m.me/another',
    );
    expect(screen.getByRole('link', { name: EMAIL })).toBeInTheDocument();
  });

  it('shows a changed business name and keeps the address', async () => {
    renderFacts(['business']);
    await screen.findByText('Sample Shop');
    answerSite({ ...demoSite, businessName: 'Renamed Shop' });
    act(() => {
      invalidatePublicContent();
    });
    expect(await screen.findByText('Renamed Shop')).toBeInTheDocument();
    expect(screen.getByText('12 Sample St., Poblacion, Sample City, Sample Province, Philippines')).toBeInTheDocument();
  });

  it('shows a changed address and keeps the business name', async () => {
    renderFacts(['business']);
    await screen.findByText('Sample Shop');
    answerSite({ ...demoSite, address: { ...demoSite.address, street: '99 New Rd.' } });
    act(() => {
      invalidatePublicContent();
    });
    expect(await screen.findByText('99 New Rd., Sample City, Sample Province, Philippines')).toBeInTheDocument();
    expect(screen.getByText('Sample Shop')).toBeInTheDocument();
  });
});

describe('LegalFacts under StrictMode', () => {
  it('draws the shop facts, the DPO line and the contact lines, whether the render is cached or fresh', async () => {
    await inStrictMode(async () => {
      renderFacts(['business', 'dpo', 'contact']);
      expect(await screen.findByRole('link', { name: EMAIL })).toBeInTheDocument();
      expect(screen.getByText('Sample Shop')).toBeInTheDocument();
      expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });

  it('draws the error banner under StrictMode', async () => {
    await inStrictMode(async () => {
      server.use(siteFailureHandler());
      renderFacts(['business', 'contact']);
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
