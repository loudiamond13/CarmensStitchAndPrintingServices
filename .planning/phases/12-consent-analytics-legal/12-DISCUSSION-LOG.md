# Phase 12: Consent, Analytics & Legal - Discussion Log
*Created: 2026-11-15T21:10:00-06:00 · Updated: 2026-11-15T21:10:00-06:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-11-15
**Phase:** 12-consent-analytics-legal
**Areas discussed:** How long we keep data, Legal pages and text, Cookie banner, Visitor stats page, extra areas (old ranges, referrers, re-ask)

---

## How long we keep data

| Question | Options | Selected |
|---|---|---|
| Orders and money records | Keep forever / Delete after 10 years / Delete after 5 years | Keep forever |
| Unconverted inquiries | After 12 months / After 6 months / Decide in Phase 13 | After 6 months |
| Daily counts after the 13-month raw purge | Keep forever / Delete after 3 years | Delete after 3 years |
| Consent records | 13 months / 3 years | 13 months |

**Notes:** The owner asked what "totals" meant. Explained: raw visits are rows tied to a visitor id (personal data). Daily counts are per page and per day with no id. Unique visitors can't be counted once the raw rows are gone. The question was then asked again in plainer words.

## Legal pages and text

| Question | Options | Selected |
|---|---|---|
| Law | Philippines only / Philippines plus general wording | Philippines only |
| Reviewer | A lawyer later / Owner reviews / Not decided | Owner reviews, lawyer optional later (confirmed after a follow-up) |
| Where the text lives | In code / Manager-editable | In code |
| Controller name and address | Placeholders / Use Contact page values | Use Contact page values |
| DPO | Owner by role / Named person | Owner by role |
| Privacy contact | Contact page email / Separate privacy email | Contact page email |
| DRAFT mark | Notice box at top / DRAFT in title | Notice box at top |

**Notes:** The owner asked what type of lawyer would review the text. Answer: a Philippine data privacy / ICT lawyer for a one-time review (RA 10173 and NPC rules for the policies; RA 7394 and RA 11967 for the Terms). Cheaper routes: an IBP chapter referral and the free NPC guides. Given as general information, not legal advice.

## Cookie banner

| Question | Options | Selected |
|---|---|---|
| Banner style | Bottom bar / Centered pop-up | Bottom bar |
| Categories | Analytics + Maps / Analytics only | Analytics + Maps |
| Map tap without consent | Ask once "Always show maps?" / This time only | Ask once |
| Clear my data location | Settings panel / Also on Cookie Policy page | Settings panel |
| GPC | No banner, stats off / Banner with stats locked off | No banner, stats off |
| Staff visits | Don't count signed-in staff / Count everyone | Don't count signed-in staff |

## Visitor stats page

| Question | Options | Selected |
|---|---|---|
| Placement | Own page / Own page plus dashboard card | Own page |
| Default range | Last 30 days / This month | Last 30 days |
| CSV | One row per day / Several sections | One row per day |
| Web Vitals display | Plain words with color / Numbers only | Plain words with color |

## Extra areas

| Question | Options | Selected |
|---|---|---|
| Ranges older than 13 months | Show visits and explain the rest / Limit picker to 13 months | Show visits and explain |
| Referrers | Group as Facebook etc. / Show each address | Group |
| Who triggers re-asking consent | Reviewed release only / Manager button | Reviewed release only |

## Claude's Discretion

Browser storage of consent, table design, visitor id and session handling, IP hashing details, collect endpoint and rate limits, rollup timing, legal routes and wording, and the chart build.

## Deferred Ideas

Optional lawyer review (backlog), Manager-editable legal text, a dashboard stats card, and an admin "ask everyone again" button.
