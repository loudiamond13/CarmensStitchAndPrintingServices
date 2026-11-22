---
phase: 12-consent-analytics-legal
plan: 20
subsystem: public-site
tags: [consent, map-card, google-map, react, a11y]
created: "2026-11-17T11:50:00-06:00"
updated: "2026-11-17T11:50:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-09/12-13 useConsent (mapAllowed, allowMaps, openSettings); 12-08 map-link consent source"
provides:
  - "MapCard (M1): the Google frame loads at once with a saved map yes; 'Always show maps?' after a one-time tap saves the map choice only"
  - "CONSENT_COPY.mapCard words and two link-button recipes"
affects: [12-22]

actuals:
  tokens: 6500
  tasks: 2
  commits: 4
plan_head_before: 0ac76ebaf72860bc167da5ef77baee3e456a0f9a
plan_head_after: 77247c76e89becd3c29db15162a3426db2a3705b

tech-stack:
  added: []
  patterns:
    - "MapCard reads the shared consent store with useConsent; the frame is shown when the visitor tapped OR map consent is saved"
    - "Focus moves into the frame only after the visitor's own tap; after Always show maps? focus moves to the status line"

key-files:
  created: []
  modified:
    - web/src/modules/public/components/MapCard.tsx
    - web/src/modules/public/components/contact.recipe.ts
    - web/src/modules/public/components/contact.test.tsx
    - web/src/modules/public/consentCopy.ts
    - web/src/modules/public/hooks/useConsent.test.tsx

key-decisions:
  - "A choice made in the bar or the Cookie Settings window loads or unloads the Contact frame at once (the card follows the store, not a one-time seed)"
  - "After Always show maps? the one-time tap is dropped, so the frame follows the saved choice and unloads if maps are turned off later"
  - "A frame that loads by consent never takes focus (WCAG 2.4.3); only the visitor's own tap does"

requirements-completed: [ANL-01, ANL-07]

coverage:
  - id: D1
    description: "With a saved map yes the frame loads on first render, with no Show Map, the label card under the frame and the line 'The map is from Google. You can turn it off in Cookie Settings.' (Cookie Settings opens the window)"
    requirement: ANL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx#MapCard with map consent (D-18, 11 D-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Without map consent, or before any choice, no iframe exists until Show Map is tapped; the Phase 11 line is unchanged"
    requirement: ANL-01
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx (map off, no choice, no embed link tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "After the tap, Always show maps? posts { stats: null or the saved value, map: true, source: 'map-link' }, the bar keeps asking, stats stay off, and the link is replaced by the polite status; works under GPC"
    requirement: ANL-07
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx#MapCard Always show maps (D-18, D-20, ANL-07)"
        status: pass
      - kind: unit
        ref: "web/src/modules/public/hooks/useConsent.test.tsx#Always show maps (D-18)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 16:10 box class string is identical before the tap, after the tap and after Always show maps; zero axe violations in the allowed, tapped and saved states"
    verification:
      - kind: unit
        ref: "web/src/modules/public/components/contact.test.tsx (16:10 and axe tests)"
        status: pass
    human_judgment: false
---

# Phase 12 Plan 20: Contact map follows the visitor's map choice Summary

*Created: 2026-11-17T11:50:00-06:00 · Updated: 2026-11-17T11:50:00-06:00*

The Contact map now follows the visitor's map consent. With a saved yes the Google frame loads at once. Without it nothing from Google loads until Show Map is tapped, and after that tap "Always show maps?" saves the map choice in place as a logged decision (source `map-link`), without touching visitor stats.

## What changed

- `MapCard.tsx` reads `useConsent()`. The frame shows when the visitor tapped or `mapAllowed` is true. With consent, the label card sits under the frame and a Small muted line reads "The map is from Google. You can turn it off in", a "Cookie Settings" link button (opens the window) and ".".
- After a one-time tap, "Always show maps?" appears under the label card. Pressing it calls `allowMaps()` and the link gives way to the polite status "Maps will show right away from now on. You can change this in Cookie Settings." Focus moves to that status line so keyboard users do not lose their place.
- `consentCopy.ts` has the `mapCard` words. `contact.recipe.ts` has two link-button looks (inline, and 44px standalone).
- `// SPEC-DEVIATION: D-18` marks the change in `MapCard.tsx`. No new CSP source, no package, no store change: `allowMaps` and `mapOnlyChoice` from 12-09/12-13 already did the map-only save.

## TDD record

- RED 1 (`8a47d0e6`): `contact.test.tsx` run: 4 failed, 32 passed. The four failures were on the planned behavior: no iframe with a saved map yes (x2), no "Cookie Settings" button, no frame after a bar choice. semanticAssessment: the target tests ran and failed on the planned assertions (missing iframe or button), not on syntax or setup.
- GREEN 1 (`d4dd3514`): 36 passed.
- RED 2 (`c59bd2ea`): `contact.test.tsx` and `useConsent.test.tsx`: 8 failed, 90 passed. All 8 failed with "Unable to find ... button 'Always show maps?'". semanticAssessment: valid RED, the control did not exist. The new GPC test in `useConsent.test.tsx` passed already (the store handled it): it is a regression guard, not a RED test.
- GREEN 2 (`77247c76`): 99 passed (contact, useConsent, no-long-dash).
- No REFACTOR commit.

## Verification (real output)

- `npm --prefix web run test -- --run src/modules/public/components/contact.test.tsx src/modules/public/hooks/useConsent.test.tsx src/test/no-long-dash.node.test.ts`: `Test Files 3 passed (3)`, `Tests 99 passed (99)`.
- `npm --prefix web run lint` (`--max-warnings 0`): no output, exit 0.
- `npx tsc -p tsconfig.app.json`: exit 0, no output.
- `npm --prefix web run test -- --run src/modules/public src/layouts src/test`: first run 7 failed, 1247 passed, with failures in `PublicLayout.test.tsx`, `GalleryPage.test.tsx` and `ProductsPage.test.tsx`. These files do not use MapCard. A sibling executor was running at the same time. Re-run alone: `Test Files 3 passed (3)`, `Tests 113 passed (113)`. Recorded as load-related flakes (timeouts waiting for data), not hidden.
- `npm --prefix web run build:budget` (limit 150 KB, not raised):

| Public page | Gzip JS | Result |
|---|---|---|
| home | 147.66 KB | ok |
| products | 144.35 KB | ok |
| gallery | 145.70 KB | ok |
| contact | 149.20 KB | ok |
| privacy | 149.39 KB | ok |
| cookies | 149.29 KB | ok |
| terms | 148.50 KB | ok |
| accessibility | 148.06 KB | ok |
| notFound | 140.42 KB | ok |

  admin JS 220.33 KB (limit 250), CSS 20.42 KB (limit 35). Contact moved from 147.90 to 149.20 KB (0.80 KB left); Privacy is 149.39 KB (0.61 KB left), slightly more room than the 149.60 KB measured after wave 5. The Contact growth is MapCard code in the Contact route chunk plus the shared copy chunk it now imports. Later plans that add code to Contact or the shared copy chunk have under 1 KB to spend.
- `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner`: no leaks found on all four commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Label card lost its overlay while the shop facts load with map consent**
- **Found during:** Task 1
- **Issue:** With `loaded` true but no embed link yet (facts loading), the old condition would drop the overlay class and leave the label unstyled inside the drawn map.
- **Fix:** One `showFrame` value (`embed !== null && (tapped || mapAllowed)`) drives the frame, the overlay class and the lines. Covered by a test.
- **Commit:** `d4dd3514`

**2. [Rule 2 - Missing critical] Focus handling**
- **Found during:** Task 1 and 2
- **Issue:** The Phase 11 effect focused the frame whenever it loaded. With consent that would steal focus on page load. Pressing "Always show maps?" removes the focused button, which would drop focus to the page.
- **Fix:** Focus moves into the frame only after the visitor's tap; after the save, focus moves to the status line (`tabIndex={-1}`).
- **Commit:** `d4dd3514`, `77247c76`

**3. Commit trailer:** the plan and the owner rules name `Claude Opus 5.5`. The commits carry `Co-Authored-By: Claude Sonnet 5.5`, because that is the model that did the work and the harness attribution says so.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or CSP source. T-12-55 is met: the frame renders only after a tap or a saved map yes, and tests assert no iframe otherwise.

## Open questions for the owner

None blocking. Two small notes, with my recommendation first:

1. After "Always show maps?" the status line stays until the page changes. If maps are later turned back on from Cookie Settings in the same page view, the same status line shows in place of the "turn it off in Cookie Settings" line. **Recommend: leave as is** (the words are still true). Alternative: reset it when maps go off.
2. The status line takes focus after the save and shows the browser's default focus ring. **Recommend: leave as is** for the UI review to judge. Alternative: hide the ring on that line.

## TDD Gate Compliance

RED (`test(12-20)`) precedes GREEN (`feat(12-20)`) twice: `8a47d0e6` then `d4dd3514`, and `c59bd2ea` then `77247c76`. Gate sequence satisfied.

## Self-Check: PASSED

- FOUND: web/src/modules/public/components/MapCard.tsx, contact.recipe.ts, contact.test.tsx, consentCopy.ts, useConsent.test.tsx
- FOUND commits: 8a47d0e6, d4dd3514, c59bd2ea, 77247c76 (`git rev-list --count` from the plan base: 4)
