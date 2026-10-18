// SPEC-GAP: ComponentShowcasePage (UI-SPEC C1 and "Phase 2 pages" → ComponentShowcase; WEB-06, A11Y-01, D-22, D-30..D-33).
// The living style guide at /admin/components for Managers, inside the admin shell so the theme toggle applies, and at
// /dev/components in dev builds. It is a lazy chunk of its own, so it adds nothing to the initial admin JS. One page shows
// every shared building block:
//   - the `.s-ph` page head with the h1 "Component Showcase" and a warning "Demo data" badge (10px apart) over the
//     UI-SPEC subline; document title "Component Showcase · CSPS Admin";
//   - the Demo data Note as the first block after the head (D-32), so nobody reads a made-up record as a real one;
//   - one `.s-card` section per group (./showcaseSections.ts) with an h2 in the `.s-card-h h2` look;
//   - every scenario of the shared list (the implementation side of the look-equality proof, D-33), rendered through
//     the same renderNode and impl kit as the parity page, each in a fixed-width `[data-case]` frame (L-29) under its
//     id in the `.csp-overline` look. A scenario declared for one theme only (the public parts are Blush only, D-14)
//     keeps that theme in its frame; the others take the shell theme.
//   - in place of each fixed-position scenario (dialogs, the phone drawer) a live demo with real handlers, and a case
//     that would move focus on load (the open user menu) behind a "Show this example" button (./ShowcaseDemos.tsx);
//   - the skip link alone in place of its focusing wrapper (no second `main`, no focus move on load);
//   - the extra cases no scenario has: the icon names, the toast triggers, dates and a loaded LazyImage.
// The seed data is spec §12's (Carmen Reyes, Jomar Santos inactive, ORD-2026-0148, ORD-2026-0151), from the scenarios.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button, Note, overlineClasses } from '@/components';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { Badge } from '@/components/status';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios } from '@/dev/scenarios';
import type { Scenario } from '@/dev/scenarios/types';
import {
  caseClasses,
  demoFrameClasses,
  frameClasses,
  sectionBodyClasses,
  sectionClasses,
  sectionHeadClasses,
  sectionTitleClasses,
  titleRowClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { SHOWCASE_SECTIONS, scenariosBySection, type ShowcaseSectionId } from '@/modules/admin/components/showcase/showcaseSections';
import { BLOCK_REPLACEMENTS, EXTRA_CASES, VIEWPORT_DEMOS } from '@/modules/admin/components/showcase/ShowcaseDemos';

const BY_SECTION = scenariosBySection(scenarios);

/** Cases whose wrapper acts on mount and moves focus (the open user menu): shown only when asked for. */
const ON_DEMAND: ReadonlySet<string> = new Set(['user-menu-open', 'session-menu-open']);

interface CaseFrameProps {
  id: string;
  /** Set for a scenario declared for one theme only. */
  theme?: 'light' | 'dark' | undefined;
  /** A live demo's frame is no page root, so the layer it opens covers the page. */
  demo?: boolean;
  children?: ReactNode;
}

/** One case: its id in the overline look, over its `[data-case]` frame (a scrollable region named by the id). */
function CaseFrame({ id, theme, demo = false, children }: CaseFrameProps) {
  const labelId = useId();
  return (
    <div className={caseClasses}>
      <p id={labelId} className={overlineClasses}>
        {id}
      </p>
      {demo ? (
        <div data-case={id} data-theme={theme} className={demoFrameClasses}>
          {children}
        </div>
      ) : (
        // A case wider than its frame scrolls inside it, so the frame is a named, focusable region that a keyboard
        // user can scroll (WCAG 2.1.1; axe scrollable-region-focusable), named by its label.
        <div
          data-case={id}
          data-theme={theme}
          role="region"
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a sideways-scrolling region must take keyboard focus (WCAG 2.1.1)
          tabIndex={0}
          aria-labelledby={labelId}
          className={frameClasses}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A case rendered only after its button is pressed. */
function OnDemand({ scenario }: { scenario: Scenario }) {
  const [shown, setShown] = useState(false);
  if (shown) {
    return renderNode(kit, scenario.node, scenario.handlers ?? []);
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        setShown(true);
      }}
    >
      {SHOWCASE_COPY.showExample}
    </Button>
  );
}

function ScenarioCase({ scenario }: { scenario: Scenario }) {
  const theme = scenario.themes.length === 1 ? scenario.themes[0] : undefined;
  if (scenario.frame === 'viewport') {
    const Demo = VIEWPORT_DEMOS[scenario.id];
    if (Demo === undefined) {
      throw new Error(`The fixed-position scenario "${scenario.id}" has no showcase demo.`);
    }
    return (
      <CaseFrame id={scenario.id} theme={theme} demo>
        <Demo />
      </CaseFrame>
    );
  }
  const Replacement = BLOCK_REPLACEMENTS[scenario.id];
  if (Replacement !== undefined) {
    return (
      <CaseFrame id={scenario.id} theme={theme}>
        <Replacement />
      </CaseFrame>
    );
  }
  return (
    <CaseFrame id={scenario.id} theme={theme}>
      {ON_DEMAND.has(scenario.id) ? (
        <OnDemand scenario={scenario} />
      ) : (
        renderNode(kit, scenario.node, scenario.handlers ?? [])
      )}
    </CaseFrame>
  );
}

/** One group: its `.s-card` section with the h2, then its cases. Exported for the component tests. */
export function ShowcaseSection({ id, title }: { id: ShowcaseSectionId; title: string }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={sectionClasses}>
      <div className={sectionHeadClasses}>
        <h2 id={headingId} className={sectionTitleClasses}>
          {title}
        </h2>
      </div>
      <div className={sectionBodyClasses}>
        {(BY_SECTION.get(id) ?? []).map((scenario) => (
          <ScenarioCase key={scenario.id} scenario={scenario} />
        ))}
        {(EXTRA_CASES[id] ?? []).map(({ id: caseId, Component, demo }) => (
          <CaseFrame key={caseId} id={caseId} demo={demo === true}>
            <Component />
          </CaseFrame>
        ))}
      </div>
    </section>
  );
}

/** The route component of /admin/components and /dev/components. */
export function ComponentShowcaseRoute() {
  useEffect(() => {
    document.title = SHOWCASE_COPY.documentTitle;
  }, []);
  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={titleRowClasses}>
            <h1 className={pageTitleClasses}>{SHOWCASE_COPY.heading}</h1>
            <Badge tone="warning">{SHOWCASE_COPY.badge}</Badge>
          </div>
          <p className={pageSublineClasses}>{SHOWCASE_COPY.subline}</p>
        </div>
      </div>
      <Note icon="info">{SHOWCASE_COPY.banner}</Note>
      {SHOWCASE_SECTIONS.map((section) => (
        <ShowcaseSection key={section.id} id={section.id} title={section.title} />
      ))}
    </>
  );
}
