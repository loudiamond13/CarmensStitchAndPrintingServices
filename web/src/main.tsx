import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tracer slice (WEB-01): proves the shell builds into the API web root and is served there. Plan 05 adds the
// stylesheets and plan 14 replaces this body with the router.
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
