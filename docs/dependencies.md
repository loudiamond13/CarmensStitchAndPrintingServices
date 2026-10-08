# Dependencies: what we use and why it costs nothing

*Created: 2026-10-07T08:46:51-05:00 · Updated: 2026-10-07T15:53:21-05:00*

This page explains, in plain words, the outside software CSPS is built with and the rules for adding more. The machine-readable list is `docs/dependencies.json`. An automated test (`DependencyRegistryTests`) fails the build if that list and the project's actual pins ever disagree.

## What a software license is

A software license is **permission**, not a bill. It is the author's written statement of what you may do with their code. Every license we allow lets us use the code **for free, forever, in a commercial business**. Most only ask us to keep the author's copyright notice in a "third-party notices" file.

| License | What it means for us | Cost |
|---------|----------------------|------|
| MIT | Free to use, change and ship. We keep the author's copyright notice. | Free |
| Apache-2.0 | Same as MIT, plus the author promises not to sue us over their patents in that code. | Free |
| BSD-2-Clause / BSD-3-Clause | Same as MIT. The 3-clause version also says we may not use the author's name to advertise. | Free |
| ISC | A shorter wording of MIT. | Free |

**Every package and tool in the list is free.** Nothing in it needs a subscription, a seat license or a payment of any kind. The only things the business pays for are the SmarterASP.NET hosting and the domain it already has (owner decision D-00).

## The two approved exceptions (D-18)

| License | Allowed only for | Why it is safe |
|---------|------------------|----------------|
| MPL-2.0 | Test tools (axe-core accessibility checks) | Free. It only asks that changes to *those files* stay open. Test tools never ship to the website. |
| OFL-1.1 | Web fonts (@fontsource) | Free font license. Fonts may ship with the site; they just cannot be sold on their own. |

Licenses that are **never** allowed: GPL, AGPL, SSPL, and any paid or proprietary ("commercial") license. The only exception is the two free Microsoft parts below, each approved by the owner for one exact version.

## Two free Microsoft parts that are not open source (approved 2026-10-07)

The SQL Server driver that the app uses to talk to its database brings along two small Microsoft parts. They are not open source. They come under Microsoft's own "Microsoft Software License Terms" instead of one of the licenses above. The owner approved them on **2026-10-07** after reading what that means:

- **Free.** They cost nothing, now or later. No subscription, seat or payment.
- **Not open source.** We may use them and ship them with the app, but we may not change them or sell them on their own.
- **Ships inside the app only.** They are copied, unchanged, into the published website files and nowhere else.
- **Microsoft's notices are kept.** `THIRD-PARTY-NOTICES.md` lists both with a link to the full license text.

| Part | Exact version | License | Why it is there |
|------|---------------|---------|-----------------|
| Microsoft.Data.SqlClient.SNI.runtime | 6.0.2 | Microsoft Software License Terms - Microsoft.Data.SqlClient.SNI Library | The driver's network library on Windows. Pulled in by Microsoft.Data.SqlClient 6.1.6, which EF Core's SQL Server provider 10.0.12 uses. |
| Microsoft.Identity.Client.NativeInterop | 0.20.6 | Microsoft Software License Terms | A sign-in helper the driver always brings along. Pulled in by Microsoft.Identity.Client.Broker 4.84.2, which Microsoft.Data.SqlClient 6.1.6 uses. |

The approval covers **only these exact versions**. They are listed in `docs/license-exceptions.json`, and the license gate (`tools/scripts/New-ThirdPartyNotices.ps1`) fails if either part changes version, or if any other package arrives under a license we do not allow. A new version needs a new owner approval. The approval is also recorded in `docs/dependencies.json` under `approvals`.

## What ships to the website

Only the four `src/Csps.*` projects are published to the host. Everything marked `test`, `build` or `tool` in the list stays on the developer machine and the build server. It never reaches the website.

## The 14-day release cool-down (D-19)

We adopt a new version of a package only after it has been public for **at least 14 days**. Brand-new releases sometimes carry mistakes or, rarely, are hijacked. Waiting two weeks lets the wider community find those problems first.

- Each entry records the date the version was published and the date we adopted it. The test checks that the gap is at least 14 days. Exactly 14 days is fine; 13 days is not.
- A security fix may skip the wait. When that happens, the entry says `accepted:` followed by the reason, so the exception is always written down.

## Owner approval

The owner approved the full Phase 1 list on **2026-10-07**, before anything was downloaded (plan 01-01, package legitimacy gate). The approval is recorded in `docs/dependencies.json` under `approvals`.

## Planned (not yet installed)

These are approved for a later phase but not downloaded yet. They sit in a separate `planned` list in `docs/dependencies.json`. The automated check reads only the main list, because nothing here is installed yet. The phase that installs a planned package moves it into the main list and pins its exact version.

| Package | Version | License | What it does | Approved | Installed in |
|---------|---------|---------|--------------|----------|--------------|
| nuqs | 2.10.1 | MIT (free) | Keeps what a list shows (filters, search, sort, page, tab and view) in the web address, so Back, refresh, bookmarks and shared links reopen the same view. It adds about 5.6 KB, compressed, to the pages that use it. Its one helper package, @standard-schema/spec 1.1.0, is MIT too. | Owner, 2026-10-07 | Phase 2 (Web Foundation) |

Before installing, Phase 2 checks again for a newer stable version that is at least 14 days old, for example a 2.10.2, which fixes a known bug. It switches only if the owner approves that exact version. Phase 2 also teaches the automated check to read the web project's pins (`web/package.json`), so the main list and the web pins can never disagree.

## Adding a dependency

1. Record its purpose, license, maintenance status and a legitimacy check in the phase RESEARCH.md.
2. Pin an exact version in `Directory.Packages.props` (or `.config/dotnet-tools.json` for a tool) that is at least 14 days old.
3. Add an entry to `docs/dependencies.json`, keeping the list sorted by id.
4. Run `dotnet test --project tests/Csps.ArchitectureTests`. It fails if anything is missing, mismatched, unsorted, duplicated or under a license we do not allow.
5. Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1`. It checks the license of every package the new one pulls in, and regenerates `THIRD-PARTY-NOTICES.md`. Commit the updated notices. If it reports a package it does not allow, ask the owner first. Never widen `docs/allowed-licenses.json` or `docs/license-exceptions.json` to make it pass.
