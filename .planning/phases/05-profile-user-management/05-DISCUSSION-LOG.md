# Phase 5: Profile & User Management - Discussion Log

*Created: 2026-10-17T12:30:00-05:00 · Updated: 2026-10-17T12:30:00-05:00*

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log keeps the alternatives that were considered.

**Date:** 2026-10-17
**Phase:** 05-profile-user-management
**Areas discussed:** Deleting a user (C-41), Existing audit trigger, Admin shell, Audit log viewer, Component showcase on the live site, Add user dialog, Lock vs deactivate, Stale-save conflict (409), Theme and profile page

**Owner rules given with the command (not asked):** full-bleed layout, sticky sidebar, no SQL triggers from now on. Mid-discussion: put all Phase 5 work on a new branch (`gsd/phase-05-profile-user-management`).

---

## Deleting a user (C-41)

| Question | Options | Selected |
|---|---|---|
| How the name survives | Keep the user row / Store a name snapshot | Keep the user row |
| Undo a delete | No, final / Restore from a Deleted filter | No, final |
| Email reuse | Freed / Blocked | Freed |
| Label on records | Name plus a "former staff" hint / Just the name | Name plus a hint |

## Existing audit trigger

| Question | Options | Selected |
|---|---|---|
| Existing `TR_AuditLog_AppendOnly` | Keep it, no new ones / Remove it / Replace with a ledger table | Keep it, no new ones |
| Enforcement | Test fails on any new trigger / Written rule only | Test |

## Admin shell

| Question | Options | Selected |
|---|---|---|
| Top bar | Pin it too / Scrolls away | Pin it too |
| Short screen | Sidebar scrolls on its own / Fall back to normal scrolling | Own scroll |
| Phones | Keep drawer, pin top bar / Unchanged | Keep drawer, pin top bar |
| Scope | Full bleed everywhere, sticky admin only / Admin only | Everywhere, sticky admin only |

## Audit log viewer

| Question | Options | Selected |
|---|---|---|
| Default range | 7 days / 30 days / All 8 months | 7 days |
| Row detail | Summary that expands / Flat table | Expands |
| Scope | Managers see everything / User management only | Everything |
| Export | Not in Phase 5 / CSV | Not in Phase 5 |

## Component showcase on the live site

The owner raised this in the area picker: ship the dev component showcase (`/dev/components`) to the live site to show a coworker.

| Question | Options | Selected |
|---|---|---|
| Access | Signed-in staff / Anyone with the link | Free text: "Manager only" |
| Coworker | Invite as Admin / Has an account / Public | Invite as Admin (later clarified) |
| Demo label | Banner / None | Banner |
| Lifetime | Keep, staff-only / Temporary | Keep |
| Clarification | Any staff / Managers only | "Manager only". The coworker is from the owner's day job, not a user of this app, so the owner shows it from their own session |
| Sidebar link | Direct link only / Sidebar item | Direct link only |

## Add user dialog

| Question | Options | Selected |
|---|---|---|
| Default onboarding | Email an invitation / Temporary password | Invitation |
| Invite life | 72 hours / 7 days | 7 days |
| Show temporary password | Once with Copy / Only in the form | Once with Copy |
| Default role | Admin preselected / Must choose | Admin preselected |

## Lock vs deactivate

| Question | Options | Selected |
|---|---|---|
| Lock behavior | Until unlocked / Set time | Until unlocked |
| Self-reset while locked | No / Yes | No |
| "Active" for the last-Manager guard | Not deactivated, deleted or Manager-locked / Not deactivated or deleted | Not deactivated, deleted or Manager-locked |
| Self lock | No / Yes | No |

## Stale-save conflict (409)

| Question | Options | Selected |
|---|---|---|
| Typed edits | Keep until "Load latest" / Reload at once / Side by side | Keep until "Load latest" |
| Roster actions | Every action sends the version / Only form saves | Only form saves |

## Theme and profile page

| Question | Options | Selected |
|---|---|---|
| Theme storage | Per browser / On the account | Per browser |
| Profile layout | Sections on one page / Tabs | Tabs |
| Pending email | Current plus pending note / Nothing | Current plus pending note |
| Confirm link life | 24 hours / 7 days | 24 hours |

## Claude's Discretion

The deleted-marker shape, the scrambled-email format, how the full-bleed and sticky layout is built, and the triage order of IN-01..IN-19.

## Deferred Ideas

- Audit-log CSV export
- Theme saved on the account
