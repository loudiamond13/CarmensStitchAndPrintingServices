import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts (self-hosted via @fontsource; all subsets incl. latin-ext for the ₱ glyph). Source: CSPS-UI-SPEC.md App. D.6.
// The weight files carry unicode-range, so the browser downloads only the subsets a page uses (research Pitfall 18).
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource-variable/archivo';
import './styles/globals.css';
import './styles/spec-gaps.css'; // SPEC-DEVIATION: D-07 overrides/spec-gaps load order
import './styles/overrides.css'; // SPEC-DEVIATION: D-07 overrides/spec-gaps load order

// Tracer slice (WEB-01): proves the shell builds into the API web root and is served there. Plan 14 replaces this
// body with the router.
const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <main id="main">
      <h1>Site update in progress.</h1>
    </main>
  </StrictMode>,
);
