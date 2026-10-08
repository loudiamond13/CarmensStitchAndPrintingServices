import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// SPEC-DEVIATION: D-33. App. D.6 imports globals.css plus the CSPS component and screen stylesheets; under D-33 the
// single Tailwind entry is the only stylesheet import.
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
