# Phase 13: Quote Inquiries - Discussion Log
*Created: 2026-11-21T20:20:00-06:00 · Updated: 2026-11-21T20:20:00-06:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives considered.

**Date:** 2026-11-21
**Phase:** 13-quote-inquiries
**Areas discussed:** Attached files, Staff email, Inbox and who sees it, Turning a request into an order, plus follow-ups (bot guards, rate limit, menu, privacy notice)

---

## Attached files

| Question | Options | Selected |
|---|---|---|
| File types | Photos only (JPG, PNG, WebP, HEIC) / Photos plus PDF / Photos, PDF and AI (as spec) | Photos only |
| Count and size | Up to 5, 10 MB each / Up to 3, 10 MB / Up to 10, 10 MB | Up to 5, 10 MB each |
| Photo upload fails | Save the request anyway / Reject the whole request | Save anyway |
| Spam or Closed photos | Spam photos go at once / Keep everything 6 months | Spam photos go at once |
| Shrink in browser | Send as-is / Shrink first | Send as-is |
| Preview before send | Previews with a remove button / File names only | Previews with remove |

## Staff email

| Question | Options | Selected |
|---|---|---|
| Recipient | New "Quote alerts" setting / Existing shop email / Every active Manager | Quote alerts setting |
| Email content | Summary plus a link / Just a link / Everything except photos | Summary plus a link |
| Bursts | One each with a cap of 20 an hour / One each, no cap / Hourly summary | One each with a cap |
| Visitor confirmation email | No, on-screen only / Yes, send a copy | No |
| Test email button | Yes / No | Yes |
| Failed alert | Inbox badge is enough / Warning in the inbox | Badge is enough |

## Inbox and who sees it

| Question | Options | Selected |
|---|---|---|
| Who sees it | Admin and Manager / Manager only / Both see, only Manager converts or marks Spam | Admin and Manager |
| Unread | Shared: New until someone acts / Per person / Shared: opened by anyone | Shared: New until someone acts |
| Status changes | Free, except Converted / Forward only | Free, except Converted |
| Manual delete | Manager only with a confirm / Admin and Manager / No, wait for cleanup | Manager only |
| Internal note | Running list of notes / One editable note | Running list |
| First view | Open requests, newest first / Everything | Open requests |

## Turning a request into an order

| Question | Options | Selected |
|---|---|---|
| Product choices on the form | Public product lines / Fixed UI spec list | Public product lines |
| What convert does | Open a prefilled New Order form / Create a draft order at once | Prefilled form |
| Photos carry over | Copied into order photos / Stay on the request | Stay on the request |
| Converted request kept | As long as its order / 6 months like others | As long as its order |
| One or many orders | One request, one order / Several orders | One request, one order |

**Note:** the "Stay on the request" option text shown to the owner was garbled mid-sentence, but its meaning (photos stay on the request, reachable from the order through the link) was clear and was confirmed by the next answer (converted requests are kept as long as the order).

## Follow-ups

| Question | Options | Selected |
|---|---|---|
| What a caught bot sees | Normal success, nothing saved / An error message | Normal success |
| Rate limit message | Plain message with Messenger, 5 an hour / Stricter limit, 3 an hour | Plain message, 5 an hour |
| Inbox in the menu | "Quote Requests" after Orders / A tab inside Orders | Own menu item |
| Privacy notice | Accurate short notice / Keep the spec line plus the link | Accurate short notice |

## Claude's Discretion

- Bot-guard details and exact rate-limit numbers (as settings with tests).
- Inbox list and detail layout (`// SPEC-GAP:`), Contact page swap from the Phase 11 card, visitor copy for the error and limit states, and how the Spam photo removal and purge join the maintenance jobs.

## Deferred Ideas

- PDF and AI attachments (v2, with ORD-V2-01).
- A confirmation email to the visitor.
- One request making several orders.
