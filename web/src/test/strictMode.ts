// Runs a test body with every render wrapped in React StrictMode. StrictMode renders each component twice on mount and reuses the
// first render's memo cache for the second, so the React Compiler's "cached" branch runs as well as the fresh one. A test that only
// proves a screen draws under StrictMode keeps those branches measured without a re-render step in every test.
import { configure } from '@testing-library/react';

export async function inStrictMode(body: () => void | Promise<void>): Promise<void> {
  configure({ reactStrictMode: true });
  try {
    await body();
  } finally {
    configure({ reactStrictMode: false });
  }
}
