import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

// WEB-05: the production build logs nothing to the console; development keeps React's default reporting. React
// reports what an error boundary caught through onCaughtError, so it is silenced in production.
const silent = (): void => undefined;
const reportErrors = import.meta.env.PROD ? silent : undefined;

createRoot(rootElement, {
  onCaughtError: reportErrors,
  onUncaughtError: reportErrors,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
