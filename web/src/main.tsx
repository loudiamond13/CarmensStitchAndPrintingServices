import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
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
import { router } from '@/app/router';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

// WEB-05: the production build logs nothing to the console; development keeps React's and React Router's default
// reporting. React reports what an error boundary caught through onCaughtError, and React Router logs a render error
// its route ErrorBoundary caught unless RouterProvider has an onError, so both are silenced in production.
const silent = (): void => undefined;
const reportErrors = import.meta.env.PROD ? silent : undefined;

// SPEC-DEVIATION: D-19 (research Pattern 2) the data router replaces App. D.6's <BrowserRouter> and LinkProvider.
createRoot(rootElement, {
  onCaughtError: reportErrors,
  onUncaughtError: reportErrors,
}).render(
  <StrictMode>
    <RouterProvider router={router} {...(import.meta.env.PROD ? { onError: silent } : {})} />
  </StrictMode>,
);
