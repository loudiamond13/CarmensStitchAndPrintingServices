# Dependencies: what we use and why it costs nothing

*Created: 2026-10-07T08:46:51-05:00 · Updated: 2026-10-08T06:00:00-05:00*

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

## The approved license exceptions (D-18, D-26)

| License | Allowed only for | Why it is safe |
|---------|------------------|----------------|
| MPL-2.0 | Test tools (axe-core accessibility checks) and build tools (lightningcss, the CSS engine inside Vite 8 and Tailwind 4) | Free. It only asks that changes to *those files* stay open. Test and build tools never ship to the website. |
| OFL-1.1 | Web fonts (@fontsource) | Free font license. Fonts may ship with the site; they just cannot be sold on their own. |

The registry check matches an exception on **license and scope together**, so one license can be allowed for more than one scope (MPL-2.0 for `test` and `build`), and a license allowed for one scope still fails for any other (OFL-1.1 outside `font`, MPL-2.0 for `runtime`).

The web build and test tools also pull in, deep inside their own dependencies, four more free licenses. The owner approved them on **2026-10-07** (D-26) for the developer and build tree only. None of these packages is listed in this registry, because we never pin them directly; the npm license gate checks them instead.

| License | What it means | Example package | Brought in by |
|---------|---------------|-----------------|---------------|
| CC-BY-4.0 | Free data license; credit the authors | caniuse-lite (browser support data) | Babel and browserslist |
| CC0-1.0 | Public domain; no conditions | language-subtag-registry | the accessibility lint plugin |
| BlueOak-1.0.0 | Permissive, like MIT | minimatch | the accessibility lint plugin |
| 0BSD | Permissive, no conditions | tslib | lighthouse |

On **2026-10-08** the owner approved three more on the same terms (D-26 addendum, decision D-BL-01), again for the developer and build tree only:

| License | What it means | Example package | Brought in by |
|---------|---------------|-----------------|---------------|
| MIT-0 | MIT without even the keep-the-notice condition | @csstools/color-helpers, @csstools/css-syntax-patches-for-csstree | jsdom (the test DOM) |
| CC-BY-3.0 | Free data license; credit the authors (older CC-BY-4.0) | spdx-exceptions, spdx-ranges | license-checker-rseidelsohn (the license gate tool) |
| Python-2.0 | Permissive like BSD; keep the notice | argparse | openapi-typescript, through @redocly/openapi-core and js-yaml (tools/openapi-gen) |

What ships to the visitor's browser stays strictly MIT, ISC, Apache-2.0 or BSD, plus the OFL fonts. The gate `node web/scripts/license-gate.mjs` checks the shipped web packages with no exceptions at all, and the developer and build tree only with the exceptions listed in `npmLicenseExceptions` in `docs/license-exceptions.json`.

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

Only the four `src/Csps.*` projects and the built web app are published to the host. From the web packages, only those marked `runtime` or `font` end up in the files the browser downloads. Everything marked `test`, `build` or `tool` in the list stays on the developer machine and the build server. It never reaches the website.

## The 14-day release cool-down (D-19)

We adopt a new version of a package only after it has been public for **at least 14 days**. Brand-new releases sometimes carry mistakes or, rarely, are hijacked. Waiting two weeks lets the wider community find those problems first.

- Each entry records the date the version was published and the date we adopted it. The test checks that the gap is at least 14 days. Exactly 14 days is fine; 13 days is not.
- A security fix may skip the wait. When that happens, the entry says `accepted:` followed by the reason, so the exception is always written down.

## Owner approval

The owner approved the full Phase 1 list on **2026-10-07**, before anything was downloaded (plan 01-01, package legitimacy gate). The approval is recorded in `docs/dependencies.json` under `approvals`.

## Web packages (npm)

The web app (`web/package.json`) and the API type generator (`tools/openapi-gen/package.json`) have their own npm pins. The registry check reads both files, so every npm pin needs a registry entry too.

- **Ids name the folder.** An npm entry's id is `<folder>/<package>`, for example `web/react` or `tools/openapi-gen/typescript`. The same package can then be pinned in both folders at different versions without the two entries colliding.
- **Exact versions only.** Every npm pin must be one exact `x.y.z` version. A caret (`^1.2.3`), tilde, range, tag such as `latest`, web address or file path fails the check.
- **Aliases record the real version.** `"typescript": "npm:@typescript/typescript6@6.0.2"` is an alias: the name on the left points at another package. The entry records `6.0.2`, and its purpose says what it points at.
- **Overrides are pins too.** The `overrides` section of `web/package.json` pins a few packages that other packages bring in (rolldown and its platform files, source-map-js, http-cache-semantics, axe-core). Each has an entry, so its cool-down exception is recorded and checked like any other.
- **Scopes:** `runtime` for what ships to the browser (react, react-dom, react-router, TanStack Query, nuqs, clsx, lucide-react), `font` for the two @fontsource fonts, `test` for test tools, `tool` for the license gate and the API type generator, and `build` for everything else.

nuqs 2.10.1 was planned here before Phase 2 and is now installed. Its entry is `web/nuqs`, and the `planned` list is empty.

## Adding a dependency

1. Record its purpose, license, maintenance status and a legitimacy check in the phase RESEARCH.md.
2. Pin an exact version in `Directory.Packages.props` (or `.config/dotnet-tools.json` for a tool, or `web/package.json` for a web package) that is at least 14 days old.
3. Add an entry to `docs/dependencies.json`, keeping the list sorted by id.
4. Run `dotnet test --project tests/Csps.ArchitectureTests`. It fails if anything is missing, mismatched, unsorted, duplicated or under a license we do not allow.
5. Check the licenses of everything the new package pulls in, and regenerate the notices. For a NuGet package, run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1`, which regenerates `THIRD-PARTY-NOTICES.md`. For a web package, run `node web/scripts/license-gate.mjs`, then `node web/scripts/third-party-notices.mjs`, which regenerates `web/THIRD-PARTY-NOTICES.txt`. Commit the updated notices. If a gate reports a package it does not allow, ask the owner first. Never widen `docs/allowed-licenses.json` or `docs/license-exceptions.json` to make it pass.
