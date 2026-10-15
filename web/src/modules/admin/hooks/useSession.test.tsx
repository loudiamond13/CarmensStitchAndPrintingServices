// useSession re-renders a component when the session changes (plan 04-25).
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionResponse } from '@/test/sessionFixtures';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { useSession } from './useSession';

function Who() {
  const { user } = useSession();
  return <p>{user === null ? 'nobody' : user.name}</p>;
}

afterEach(() => {
  clearSession();
});

describe('useSession', () => {
  it('shows the session user and follows sign-in and sign-out', () => {
    render(<Who />);
    expect(screen.getByText('nobody')).toBeInTheDocument();

    act(() => {
      acceptSession(sessionResponse());
    });
    expect(screen.getByText('Carmen Reyes')).toBeInTheDocument();

    act(() => {
      clearSession();
    });
    expect(screen.getByText('nobody')).toBeInTheDocument();
  });
});
