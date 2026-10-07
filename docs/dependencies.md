# Dependencies: what we use and why it costs nothing

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

Licenses that are **never** allowed: GPL, AGPL, SSPL, and any paid or proprietary ("commercial") license.

## What ships to the website

Only the four `src/Csps.*` projects are published to the host. Everything marked `test`, `build` or `tool` in the list stays on the developer machine and the build server. It never reaches the website.

## The 14-day release cool-down (D-19)

We adopt a new version of a package only after it has been public for **at least 14 days**. Brand-new releases sometimes carry mistakes or, rarely, are hijacked. Waiting two weeks lets the wider community find those problems first.

- Each entry records the date the version was published and the date we adopted it. The test checks that the gap is at least 14 days. Exactly 14 days is fine; 13 days is not.
- A security fix may skip the wait. When that happens, the entry says `accepted:` followed by the reason, so the exception is always written down.

## Owner approval

The owner approved the full Phase 1 list on **2026-10-07**, before anything was downloaded (plan 01-01, package legitimacy gate). The approval is recorded in `docs/dependencies.json` under `approvals`.

## Adding a dependency

1. Record its purpose, license, maintenance status and a legitimacy check in the phase RESEARCH.md.
2. Pin an exact version in `Directory.Packages.props` (or `.config/dotnet-tools.json` for a tool) that is at least 14 days old.
3. Add an entry to `docs/dependencies.json`, keeping the list sorted by id.
4. Run `dotnet test --project tests/Csps.ArchitectureTests`. It fails if anything is missing, mismatched, unsorted, duplicated or under a license we do not allow.
