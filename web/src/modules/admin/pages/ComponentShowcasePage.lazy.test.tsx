import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components';
import { ComponentShowcaseRoute } from './ComponentShowcasePage';

// The Dashboard and staff money cases are a lazy chunk (wave 11 IN-01): the showcase heading must not wait for their module graph, so
// that module is not even loaded until the cases are asked for. The mock's factory runs when the module is first imported.
const loaded = vi.hoisted(() => ({ times: 0 }));

vi.mock('@/modules/admin/components/showcase/Phase10Demos', () => {
  loaded.times += 1;
  return { Phase10Demos: () => <div data-testid="phase10-demos">Phase 10 demos</div> };
});

describe('ComponentShowcase: the Dashboard and staff money cases load only on request', () => {
  it('does not load the Phase 10 demos with the page, and loads them when the button is pressed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ComponentShowcaseRoute />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Component Showcase' })).toBeInTheDocument();
    expect(loaded.times).toBe(0);
    expect(screen.queryByTestId('phase10-demos')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show the Dashboard cases' }));

    expect(await screen.findByTestId('phase10-demos')).toBeInTheDocument();
    expect(loaded.times).toBe(1);
  }, 20_000);
});

// The Site content and public website cases are a lazy chunk too (plan 11-37), loaded the same way.
const loaded11 = vi.hoisted(() => ({ times: 0 }));

vi.mock('@/modules/admin/components/showcase/Phase11Demos', () => {
  loaded11.times += 1;
  return { Phase11Demos: () => <div data-testid="phase11-demos">Phase 11 demos</div> };
});

describe('ComponentShowcase: the Site content and public website cases load only on request', () => {
  it('does not load the Phase 11 demos with the page, and loads them when the button is pressed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ComponentShowcaseRoute />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Component Showcase' })).toBeInTheDocument();
    expect(loaded11.times).toBe(0);
    expect(screen.queryByTestId('phase11-demos')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show the Site content cases' }));

    expect(await screen.findByTestId('phase11-demos')).toBeInTheDocument();
    expect(loaded11.times).toBe(1);
  }, 20_000);
});

// The Quote requests cases are a lazy chunk too (plan 13-23), loaded the same way.
const loaded13 = vi.hoisted(() => ({ times: 0 }));

vi.mock('@/modules/admin/components/showcase/Phase13Demos', () => {
  loaded13.times += 1;
  return { Phase13Demos: () => <div data-testid="phase13-demos">Phase 13 demos</div> };
});

describe('ComponentShowcase: the Quote requests cases load only on request', () => {
  it('does not load the Phase 13 demos with the page, and loads them when the button is pressed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <ComponentShowcaseRoute />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Component Showcase' })).toBeInTheDocument();
    expect(loaded13.times).toBe(0);
    expect(screen.queryByTestId('phase13-demos')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show the Quote requests cases' }));

    expect(await screen.findByTestId('phase13-demos')).toBeInTheDocument();
    expect(loaded13.times).toBe(1);
  }, 20_000);
});
