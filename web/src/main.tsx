import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts, self-hosted through Fontsource (PERF-05, App. D.6). These are the weight files: each face carries a
// unicode-range (latin, latin-ext, vietnamese) and font-display: swap, so the browser downloads only the subsets a page
// uses. Never the per-subset files, which have no unicode-range (research Pitfall 18).
// SPEC-DEVIATION: D-33 (only the font CSS and app.css are imported). App. D.6 also imports globals.css plus the CSPS
// component and screen stylesheets; under D-33 the single Tailwind entry is the only app stylesheet.
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource-variable/archivo';
import '@/styles/app.css';
import { PublicPlaceholderPage } from '@/app/public/PublicPlaceholderPage';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

// WEB-05: the production build logs nothing to the console; development keeps React's default reporting.
const silent = (): void => undefined;

createRoot(rootElement, {
  onCaughtError: import.meta.env.PROD ? silent : undefined,
  onUncaughtError: import.meta.env.PROD ? silent : undefined,
}).render(
  <StrictMode>
    <div
      data-theme="light"
      className="@container/pg relative min-h-full bg-bg font-sans text-[16px] leading-6 text-ink"
    >
      <main id="main" tabIndex={-1}>
        <PublicPlaceholderPage />
      </main>
    </div>
  </StrictMode>,
);
