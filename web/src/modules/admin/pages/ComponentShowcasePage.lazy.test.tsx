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
