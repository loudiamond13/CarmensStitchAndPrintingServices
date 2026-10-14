// The implementation side of the look-equality proof (WEB-02, D-33; dev only, never shipped, D-20, CWE-489). It renders
// the shared scenario list with the converted components (./kit) through the shared renderNode, so the reference app
// (web/visual/reference/main.tsx, the frozen App. D.3 code) and this page render one tree. The query string selects the
// cases exactly as the reference does (`?theme`, `?group`, `?case`; web/visual/reference/select.ts): each one renders
// in a `[data-case]` frame that carries the page-root look (pageRootClasses, the `.s-page` transcription) and
// `data-theme`; an empty selection renders the `data-parity-empty` marker, which fails the visual spec.
//
// Fonts and the stylesheet: the same imports as src/App.tsx (PERF-05, D-33), allowed here by a recorded lint exception
// (eslint.config.mjs, csps/restrictions/main).
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource-variable/archivo';
import '@/ui/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { selectScenarios } from '../../visual/reference/select';
import { kit } from './kit';
import { renderNode } from './renderScenario';
import { scenarios } from './scenarios';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

const selection = selectScenarios(scenarios, window.location.search);

// UiLink and ButtonLink render react-router links, so every case sits inside a router. A memory router never reads or
// changes the address bar, so the ?theme/?group/?case filter stays as loaded.
createRoot(rootElement).render(
  <StrictMode>
    <MemoryRouter>
      {selection.theme === null || selection.scenarios.length === 0 ? (
        <p data-parity-empty="">{`No parity scenario matches ${window.location.search || '(no filter)'}.`}</p>
      ) : (
        selection.scenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id} data-theme={selection.theme} className={pageRootClasses}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))
      )}
    </MemoryRouter>
  </StrictMode>,
);
