# Phase 2: Web Foundation & Design System - Discussion Log

*Created: 2026-10-07T19:31:36-05:00 · Updated: 2026-10-07T19:31:36-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-07
**Phase:** 02-web-foundation-design-system
**Areas discussed:** Accessibility vs design, Design code: copy or fix, Icons and dark theme, Developer tooling picks, Shells/showcase/visual review

Session note: the owner closed the first round of accessibility questions without answering, then added the Claude Design exports to `.planning/design/` (gitignored by quick task 261007-qde) and asked to resume. The exports were unpacked in a scratch folder outside the repo and match the spec, including the 0.72 inactive-row opacity and the 4.5 s toast.

---

## Accessibility vs design

| Question | Options | Selected |
|---|---|---|
| C-34 iOS 14px input zoom | 16px in fields on phones (Rec) / 16px everywhere / Keep 14px | 16px in fields on phones |
| C-35 inactive rows at 72% | Muted but readable (Rec) / No fading, badge only / Keep 72% | Muted but readable |
| C-35 orange-only state cue | Add a second cue (Rec) / Deeper orange for those marks / Keep | Add a second cue |
| Second cue themes | Both themes (Rec) / Light only | Both themes |
| C-35 behaviour fixes (multi) | Error toasts stay / Hidden buttons show on focus/touch / Lightbox arrows on phones | First two ticked |
| Lightbox on phones (follow-up; WCAG 2.5.1 Level A, GAL-02) | Small arrows on phones (Rec) / Tap left/right half of photo / Keep swipe only | Tap left/right half of photo |

**Notes:** the owner chose tap zones over the recommended small arrows. CONTEXT D-06 records them as real labelled buttons so they still satisfy GAL-02 and 2.5.1.

## Design code: copy or fix

| Question | Options | Selected |
|---|---|---|
| C-25 rounding | Match the server (Rec) / Keep design rounding | Match the server |
| C-22 strictness | Copy, check, fix minimally (Rec) / Relax rules for design code / Rewrite to standards | Copy, check, fix minimally |
| Fix that changes markup | Stop and ask me (Rec) / Claude decides, logs it | Stop and ask me |

## Icons and dark theme

| Question | Options | Selected |
|---|---|---|
| C-10 icons | Design's built-in icon file (Rec) / lucide-react package | lucide-react package |
| lucide-react version | 1.47.0 (Rec, passes cool-down) / 0.460.0 (identical drawings) | Free text: "use the newest version" |
| Cool-down confirm | Yes, newest at install time / Newest that's 14+ days old | Yes, newest at install time (owner waiver, lucide-react only) |
| Icon drift | Show me, I'll decide (Rec) / Accept new drawings | Show me, I'll decide |
| C-11 theme start | Always Blush (Rec) / Follow device setting | Always Blush |
| Public dark | Light only (Rec) / Add dark for public | Light only |

**Notes:** the version check on 2026-10-07 found no npm advisories and no deprecation for lucide-react 0.460.0, 1.47.0 or 1.52.0. All are ISC and all peer React 19. 1.52.0 was released 2026-10-04, so it is inside the 14-day window.

## Developer tooling picks

| Question | Options | Selected |
|---|---|---|
| S-1 TypeScript | TS6 tools + TS7 checks (Rec) / TS6 only | TS6 tools + TS7 checks |
| S-8 API types | Generator in tools/ (Rec) / Hand-written + drift check | Generator in tools/ |
| S-2/S-6/S-7 (multi) | jsx-a11y-x / in-house axe helper / doc version fixes | All three |

## Shells, showcase and visual review

| Question | Options | Selected |
|---|---|---|
| Admin shell before sign-in | Local development only (Rec) / Dev only + static sign-in screen | Local development only |
| Public shell | Header + footer + placeholder (Rec) / Empty middle | Header + footer + placeholder |
| Showcase | Dev-only page + screenshots (Rec) / Dev-only, no screenshots | Dev-only page + screenshots |
| Visual check vs designs | Side-by-side report (Rec) / Automatic pixel check / Both | Side-by-side report |

## Other actions in this session

- `tools/Csps.HostProbe/Properties/launchSettings.json` was moved from 53693/53694 (dynamic range) to 5116/7029, and root CLAUDE.md lists the ports (commit 0361a67).
- Created branch `gsd/phase-2-web-foundation-design-system` from the Phase 1 tip, pushed it with upstream tracking, and set GSD `git.branching_strategy` to `phase`.

## Claude's Discretion

- The exact token values for the muted inactive row and the second cue.
- Placeholder copy.
- The admin-route exclusion mechanism.
- The `web/` folder layout and screenshot tooling.

## Deferred Ideas

- Public dark theme (rejected for now).
- Lightbox tap zones and the 404 page belong to the public-site phase.
