// The ?product= line the quote form chooses (UI-SPEC Q4, D-24, CWE-601). The key is read once and only compared with the loaded
// lines: it never reaches a link or a navigation, and the address is never rewritten.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { isLineKey } from '../lineKey';

/**
 * The key to choose, or null. It is given once the lines arrive, only for a safe key (T-11-44) that names a shown line, and
 * only while `chosen` is empty. After that it is null for good, so a later reset never chooses it again.
 */
export function useQuoteProductPreselect(lines: readonly { key: string }[] | null, chosen: string): string | null {
  const [params] = useSearchParams();
  const [wanted, setWanted] = useState(() => {
    const key = params.get('product') ?? '';
    return isLineKey(key) ? key : null;
  });
  if (wanted === null || lines === null) {
    return null;
  }
  if (chosen !== '' || !lines.some((line) => line.key === wanted)) {
    setWanted(null);
    return null;
  }
  return wanted;
}
