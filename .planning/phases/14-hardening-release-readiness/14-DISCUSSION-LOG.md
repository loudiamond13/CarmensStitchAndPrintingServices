# Phase 14: Hardening & Release Readiness - Discussion Log
*Created: 2026-11-26T13:50:00-06:00 · Updated: 2026-11-26T13:50:00-06:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-26
**Phase:** 14-hardening-release-readiness
**Areas discussed:** Testing with no staging, Screen-reader passes, Staff app install, Runbooks and sign-off, Open backlog

---

## Testing with no staging

| Option | Description | Selected |
|--------|-------------|----------|
| CI and live | CI scans a production-mode build; one passive scan of live after a release deploy, owner-dispatched | ✓ |
| CI only | Never touch live; host-only problems unseen | |
| Live only | One passive live scan; problems found only after going live | |

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly + release | Add to the weekly workflow plus once before each release | ✓ |
| Every pull request | Adds minutes to every PR gate | |
| Release only | Cheapest; problems can sit for weeks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fix High+Medium | High and Medium fixed or owner-accepted; Low and Info listed with outcomes | ✓ |
| Fix High only | Only High/Critical block | |
| Fix everything | Every finding down to Low fixed or accepted | |

| Option | Description | Selected |
|--------|-------------|----------|
| Live; host gap to owner | Live audit; host-caused shortfall is a named owner acceptance, code-caused is fixed | ✓ |
| Live, 95 is hard | Any page below 95 blocks release | |
| CI build only | No live run | |

| Option | Description | Selected |
|--------|-------------|----------|
| CI signed in, live out | CI scans as a seeded test Manager; live stays signed out | ✓ |
| Signed out only | Staff API never scanned | |
| Both signed in | Real account and live data; not recommended | |

| Option | Description | Selected |
|--------|-------------|----------|
| Don't count | Bot filter skips scanners, with a test | ✓ |
| Count them | Fake views on scan days | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, local drill | Owner backup restored into a CSPS_ LocalDB database, checked, dropped; runbook | ✓ |
| Runbook only | Document without rehearsing | |
| Skip | Leave restore out | |

**User's choice:** all recommended options.

---

## Screen-reader passes

| Option | Description | Selected |
|--------|-------------|----------|
| Claude scripts, you run | Claude writes scripts and runs the keyboard pass; owner runs NVDA and VoiceOver | ✓ |
| Claude only, NVDA | Automated check only, no human listening pass | |
| Outside tester | Daily screen-reader user; may cost money | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, an iPhone/iPad | VoiceOver on the phone | ✓ |
| Yes, a Mac | VoiceOver with Safari | |
| No Apple device | NVDA plus TalkBack, VoiceOver as a named gap | |

| Option (multi-select) | Description | Selected |
|--------|-------------|----------|
| Get a Quote form | Main public flow on a phone | ✓ |
| Gallery and lightbox | Photos, tap zones, swipe | ✓ |
| Forgot password | Reset email flow | ✓ |
| Quote inbox to order | Staff convert a request | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| NVDA local, iPhone live | NVDA on CSPS_Dev; VoiceOver on live, TEST entries deleted, test quote marked Spam | ✓ |
| iPhone public only | Staff flows NVDA only | |
| Everything local | iPhone reaches dev over Wi-Fi | |

---

## Staff app install

| Option | Description | Selected |
|--------|-------------|----------|
| vite-plugin-pwa | Standard tool named in the stack plan, after the version check and owner yes | ✓ |
| Hand-built, no package | No dependency, more code to maintain | |

| Option | Description | Selected |
|--------|-------------|----------|
| Staff portal only | Public site untouched | ✓ |
| Whole site | Touches public budget and Lighthouse | |

| Option | Description | Selected |
|--------|-------------|----------|
| Banner, they tap | Never reloads by itself | ✓ |
| Auto-reload when idle | Page can change under staff | |

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly offline page | Plain message with Try again | ✓ |
| Browser's own error | Looks broken in an installed app | |

**Notes:** owner chose "Next area" for app name, icon and page animation, so they are Claude's discretion.

---

## Runbooks and sign-off

| Option | Description | Selected |
|--------|-------------|----------|
| Delete, blank names | Delete quotes; blank names on orders via edit screens | |
| Add a Remove button | New Manager-only action | |
| Quotes only | Delete quote requests; orders unchanged as financial records | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| You are the DPO | Owner decides; Manager does day-to-day steps | ✓ |
| A named Manager | Manager decides | |
| Decide later | Blank on the release checklist | |

| Option | Description | Selected |
|--------|-------------|----------|
| 15 days, same contact | Identity by the contact already on file | ✓ |
| 30 days, same contact | Longer window | |
| 15 days, ID photo | Holds more sensitive data | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dated line in repo | Owner replies "signed"; `Signed: owner, <date>` added | ✓ |
| Private copy off git | Paper or PDF kept by owner | |

| Option | Description | Selected |
|--------|-------------|----------|
| Lock down, then tell you | Manager deactivates, ends sessions, sets a temporary password, then tells the owner | ✓ |
| Tell you, wait | No change until the owner responds | |
| Full authority | Also takes the site down and changes secrets | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 2 Managers | Written rule | |
| One is fine | Document the one-Manager path; a reviewed step on request | ✓ |
| Warn in the app | Notice on the Users page | |

| Option | Description | Selected |
|--------|-------------|----------|
| OD-13: Keep dev-only | No API map in production; 404 test | ✓ |
| OD-13: Managers only in prod | Needs a CSP exception | |
| C-32: Confirm | Keep as built; check live logs | ✓ |
| C-32: Review it first | Security review before confirming | |

---

## Open backlog

| Option | Description | Selected |
|--------|-------------|----------|
| Must be green | Debug plan; every browser passes a full run | ✓ |
| Chromium green only | WebKit/iPhone as a named gap | |
| Own phase | Inserted Phase 14.1 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Review pack, then close | One pack, owner rules in one sitting, Phase 14 builds choices | ✓ |
| Only a11y and security | Look choices stay in the backlog | |
| Leave as is | Not touched | |

---

## Claude's Discretion

- PWA name, short name, icons and theme colour (through `/gsd-ui-phase 14`)
- View Transitions style
- Format of the CWE Top 25 and ATT&CK review
- When the live ZAP scan runs after a deploy
- Restore-drill database name (`CSPS_` prefix)

## Deferred Ideas

- Automated database backups (before the Phase 17 cutover, D-51)
- A "remove personal details" action for orders (not chosen)
- An in-app one-Manager warning (not chosen)
- An installable public site (not chosen)
