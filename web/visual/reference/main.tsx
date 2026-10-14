// The parity reference entry (WEB-02, D-33; test only, never shipped, threat T-02-35). It renders the shared 02-38
// scenario list with the frozen App. D.3 components through the shared renderNode, so the reference and the
// implementation (plan 02-14) render one tree. The query string selects the cases (./select.ts): each one renders in a
// `[data-case]` frame that carries the `.s-page` class and `data-theme`; an empty selection renders the
// `data-parity-empty` marker, which fails the visual spec.
//
// Fonts: the same self-hosted Fontsource weight files as web/src/main.tsx (PERF-05), then the reference stylesheet.
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource-variable/archivo';
// The verbatim App. A.2 stylesheet chain and the test-only rulings layer (recorded lint override in eslint.config.mjs).
import './reference.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderNode } from '../../src/dev/renderScenario';
import { scenarios } from '../../src/dev/scenarios/index';
import { kit } from './kit';
import { selectScenarios } from './select';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

const selection = selectScenarios(scenarios, window.location.search);

createRoot(rootElement).render(
  <StrictMode>
    {selection.theme === null || selection.scenarios.length === 0 ? (
      <p data-parity-empty="">{`No parity scenario matches ${window.location.search || '(no filter)'}.`}</p>
    ) : (
      selection.scenarios.map((scenario) => (
        <div key={scenario.id} data-case={scenario.id} data-theme={selection.theme} className="s-page">
          {renderNode(kit, scenario.node, scenario.handlers ?? [])}
        </div>
      ))
    )}
  </StrictMode>,
);
