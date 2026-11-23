// useQuoteProductPreselect (UI-SPEC Q4, D-24, CWE-601): the ?product= key the quote form chooses once the lines arrive.
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useQuoteProductPreselect } from './useQuoteProductPreselect';

const LINES = [{ key: 'basketball' }, { key: 'volleyball' }];

interface Props {
  lines: readonly { key: string }[] | null;
  chosen: string;
}

function run(search: string, initial: Props) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [`/contact${search}`] }, children);
  return renderHook((props: Props) => useQuoteProductPreselect(props.lines, props.chosen), {
    wrapper,
    initialProps: initial,
  });
}

describe('useQuoteProductPreselect (Q4)', () => {
  it('gives nothing with no product param', () => {
    expect(run('', { lines: LINES, chosen: '' }).result.current).toBeNull();
  });

  it('waits for the lines, then gives the known key while nothing is chosen', () => {
    const view = run('?product=volleyball', { lines: null, chosen: '' });
    expect(view.result.current).toBeNull();

    view.rerender({ lines: LINES, chosen: '' });

    expect(view.result.current).toBe('volleyball');
  });
});
