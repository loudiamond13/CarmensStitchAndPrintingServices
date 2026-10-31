# Dependencies: what we use and why it costs nothing

*Created: 2026-10-07T08:46:51-05:00 · Updated: 2026-10-26T08:30:00-05:00*

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
| Microsoft.Data.SqlClient.SNI.runtime | 6.0.3 | Microsoft Software License Terms - Microsoft.Data.SqlClient.SNI Library | The driver's network library on Windows. Pulled in by Microsoft.Data.SqlClient 6.1.7, which EF Core's SQL Server provider 10.0.13 uses. |
| Microsoft.Identity.Client.NativeInterop | 0.20.6 | Microsoft Software License Terms | A sign-in helper the driver always brings along. Pulled in by Microsoft.Identity.Client.Broker 4.84.2, which Microsoft.Data.SqlClient 6.1.7 uses. |

The approval covers **only these exact versions**. They are listed in `docs/license-exceptions.json`, and the license gate (`tools/scripts/New-ThirdPartyNotices.ps1`) fails if either part changes version, or if any other package arrives under a license we do not allow. A new version needs a new owner approval. The approval is also recorded in `docs/dependencies.json` under `approvals`.

## What ships to the website

Only the four `src/Csps.*` projects are published to the host. Everything marked `test`, `build` or `tool` in the list stays on the developer machine and the build server. It never reaches the website.

## The 14-day release cool-down (D-19)

We adopt a new version of a package only after it has been public for **at least 14 days**. Brand-new releases sometimes carry mistakes or, rarely, are hijacked. Waiting two weeks lets the wider community find those problems first.

- Each entry records the date the version was published and the date we adopted it. The test checks that the gap is at least 14 days. Exactly 14 days is fine; 13 days is not.
- A security fix may skip the wait. When that happens, the entry says `accepted:` followed by the reason, so the exception is always written down.
- **The .NET security update of 2026-10-14 (quick task 261014-gqz).** On 2026-10-13 Microsoft published fixes for security problems in two of its parts that the app uses behind the scenes: System.Security.Cryptography.Pkcs, which the SQL Server driver brings along, and System.Security.Cryptography.Xml, which Data Protection uses to lock the sign-in key ring. We moved the seven .NET pins that were at 10.0.12, plus the dotnet-ef tool, to 10.0.13. We also pinned those two parts at 10.0.13 directly, so the fixed version is used even where another package asks for an older one. The owner approved skipping the 14-day wait on 2026-10-14 because these are security fixes. Each record says `accepted:` with the advisory numbers (GHSA-2fmv-rv2c-59x7, GHSA-846f-f764-76mx, GHSA-7hqp-7c5m-4vq6, GHSA-c399-9853-6jmj and GHSA-r955-8q5j-3h83), and they reach 14 days on 2026-10-27.
- **Three more parts moved along with it, and the owner approved them on 2026-10-14.** The 10.0.13 packages ask for newer versions of Microsoft.Data.SqlClient (6.1.6 to 6.1.7, published 2026-09-10), Microsoft.Data.SqlClient.SNI.runtime (6.0.2 to 6.0.3, published 2026-08-14, same Microsoft license terms as before) and Microsoft.OpenApi (2.12.0 to 2.12.2, published 2026-08-20, MIT). None has a known security advisory and all are well past 14 days old, so no cool-down exception is needed. SNI.runtime is the one that needed a new license approval, because the license exception is pinned to an exact version: `docs/license-exceptions.json` now names 6.0.3.

## Owner approval

The owner approved the full Phase 1 list on **2026-10-07**, before anything was downloaded (plan 01-01, package legitimacy gate). The Phase 2 web packages were approved on **2026-10-07** (D-25, plus two security overrides) and **2026-10-08** (D-34 lucide-react 1.53.0, D-36 the two Tailwind tooling plugins). Each approval is recorded in `docs/dependencies.json` under `approvals`.

On **2026-10-14** the owner approved the .NET 10.0.13 security update and the two crypto pins (quick task 261014-gqz), together with the SqlClient 6.1.7, SNI.runtime 6.0.3 and Microsoft.OpenApi 2.12.2 moves that come with it. It is recorded under `approvals`.

## Phase 4 packages (approved 2026-10-14)

For staff sign-in, the owner approved these packages on **2026-10-14** (decision D-36), before anything was installed. Every one is free: MIT or Apache-2.0 means free to use in a business, and we only keep the author's notice in `THIRD-PARTY-NOTICES.md`.

| Package | What it does for the shop | License |
|---------|---------------------------|---------|
| Microsoft.AspNetCore.Identity.EntityFrameworkCore 10.0.13 | Stores staff accounts and roles in the database and handles password hashing and lockout after too many wrong tries. | MIT |
| FluentValidation 12.1.1 | Checks each request (email, password, sign-in code) against clear rules before the server acts on it. | Apache-2.0 |
| MailKit 4.18.1 | Sends the sign-in code emails over an encrypted connection. | MIT |
| MimeKit 4.18.1 | Builds the email messages that MailKit sends. Pinned so MailKit cannot quietly pull a different version. | MIT |
| BouncyCastle.Cryptography 2.7.0 | The encryption code MimeKit uses. Pinned for the same reason. | MIT |
| Microsoft.Extensions.Http.Resilience 10.10.0 | Adds a time limit and a retry to the check that a new password has not appeared in a known data breach. | MIT |
| Microsoft.Extensions.Diagnostics.Testing 10.10.0 | Tests only. Lets a test read the log and prove that no secret or code is ever written to it. Never ships. | MIT |
| react-hook-form 7.89.0 (web) | Keeps the state of each form in the browser: what was typed and which fields have errors. | MIT |
| zod 4.6.7 (web) | Checks every field in the browser before anything is sent, with the same rules the server checks (OR-3). | MIT |
| @hookform/resolvers 5.9.1 (web) | Connects the zod rules to the form so errors show next to the field. | MIT |
| msw 3.0.1 (web, tests only) | Fakes the server in tests and fails any test that tries a real network call. Never ships. | MIT |

**Security exception.** Identity.EntityFrameworkCore 10.0.13 was published on 2026-10-13, so it is younger than the 14-day wait. It is a Microsoft security servicing release (D-35) that matches the other 10.0.13 pins, and the owner approved it on 2026-10-14 (D-36). Its registry record says `accepted:` and it reaches 14 days on 2026-10-27.

**The four web packages were checked by the owner first.** The research tool flagged them as suspicious only because of how it reads npm's "latest" tag and download counts. At install time Claude checked each exact version (license MIT, no install script, no known security problem, 14 to 58 days old) and the owner replied "approved" on 2026-10-14. When npm installs msw it prints a notice that vitest's optional msw 2 link does not match msw 3.0.1. Vitest only uses that link for its browser mode, which CSPS does not use, so nothing is affected.

## A bundled list of common passwords (approved 2026-10-14)

When a new password is saved, CSPS asks a free breach-check service whether that password has leaked before. If the service cannot be reached, staff must not be locked out of changing their password, so the app falls back to a small list that ships inside it: the 10,000 most common passwords (the SecLists "10k-most-common" list).

- **Free.** It is under the MIT license, so it costs nothing and may be used in a business. We keep the author's copyright line in `THIRD-PARTY-NOTICES.md`.
- **Data, not code.** It is a plain text file with one password per line, embedded in the app and never changed.
- **Exactly the file we checked.** `docs/dependencies.json` records the address it came from (pinned to one exact commit, 913b327, from 2026-09-08, so more than 14 days old), the license and a SHA-256 fingerprint of the file. `DependencyRegistryTests` fails the build if the file's bytes ever differ, or if another data file is embedded without a record.
- **Registry kind `data`.** Unlike a package, a data record has no version pin to match. It names `source`, `sha256` and `path` instead.

## CI actions and tools (Phase 3)

Phase 3 runs the checks on GitHub for every pull request. The owner approved the items below on **2026-10-15**, before any was used (plan 03-01, reply "approve-all"). Every one is free. MIT means free to use in a business, and we only keep the author's notice. None of them is installed in the app or shipped to the website: they run only on GitHub's build machines or on a developer machine. A workflow can only use an action that is on this list, pinned to the exact commit shown (`CiWorkflowTests` fails the build otherwise).

| Item | Version | Pinned as | License | What it does for the shop |
|------|---------|-----------|---------|---------------------------|
| actions/checkout | v7.0.1 | commit 3d3c42e5aac5ba805825da76410c181273ba90b1 | MIT | Fetches the code onto the build machine. |
| actions/setup-dotnet | v6.0.0 | commit a98b56852c35b8e3190ac28c8c2271da59106c68 | MIT | Installs the .NET version named in `global.json`. |
| actions/setup-node | v7.0.0 | commit 820762786026740c76f36085b0efc47a31fe5020 | MIT | Installs Node 24.21.0 for the web checks. The newer v7.1.0 is inside the 14-day wait. |
| actions/cache | v6.1.0 | commit 55cc8345863c7cc4c66a329aec7e433d2d1c52a9 | MIT | Reuses downloaded packages between runs to save free build minutes. |
| actions/upload-artifact | v7.0.1 | commit 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a | MIT | Stores the deploy package and failure reports. The newer v7.0.2 is inside the 14-day wait. |
| zizmorcore/zizmor-action | v0.6.4 (runs zizmor 1.30.1) | commit cc914d7f3750a2d13d75c7f184a1060aa0e9d482 | MIT | Scans the workflow files for known attack patterns. |
| gitleaks | 8.30.1 | release files checked by SHA-256 (Linux 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb, Windows d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e) | MIT | Looks for passwords and keys in the code before they can be committed (D-10). |
| actionlint | 1.7.12 | release files checked by SHA-256 (Linux 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8, Windows 6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9) | MIT | Finds mistakes in the workflow files and their shell commands. |

**zizmor carries a "suspicious" flag.** The automatic research check flagged it only because the newest zizmor release (1.31.1) is one day old. The pinned 1.30.1 is 36 days old, so it is past the 14-day wait. The owner approved it with that explanation.

**Not part of this approval.** The SQL Server image for the integration tests stays `mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04`, as CLAUDE.md pins it. A newer security build (`2025-CU9-GDR1-ubuntu-24.04`) exists, and switching to it is a separate owner decision. No npm, NuGet or PyPI package was added.

## Public repository: our license and two security checks (approved 2026-10-16)

The repository is now public on GitHub. The owner approved the items below on **2026-10-16**, before anything was used. All of them are free.

- **Our own license is MIT** (`LICENSE`, "Copyright (c) 2026 loudiamond13"). In plain words: anyone may read and reuse the code, and nobody may blame us if it breaks. It costs nothing and does not change what the shop owns or how the shop runs the site.
- **CodeQL** reads the C# and the TypeScript for security mistakes (the kinds listed in the CWE Top 25) on every pull request, every push to `main` and once a week. It is free for open-source code on GitHub.com, and this repository is public and MIT-licensed, so it qualifies. Its findings show under the repository's Security tab, and no one is billed.
- **Dependency review** checks each pull request for newly added packages that have a known security problem or a license we do not allow, and fails the check if so. GitHub Actions entries are the one thing it cannot read a license for (a known issue on GitHub's side), so those show "unknown license" and are let through. The allowed list is the one in this page: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC and 0BSD, plus MPL-2.0 and OFL-1.1.

| Item | Version | Pinned as | License | What it does for the shop |
|------|---------|-----------|---------|---------------------------|
| github/codeql-action | v4.38.2 (bundles CodeQL 2.27.1) | commit 2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 | MIT (the action); CodeQL itself is free for open-source code | Scans the code for security mistakes. |
| actions/dependency-review-action | v5.0.0 | commit a1d282b36b6f3519aa1f3fc636f609c47dddb294 | MIT | Blocks a pull request that adds a vulnerable or disallowed-license package. |

Both are older than the 14-day wait and have no known advisories. They run only on GitHub's build machines and never ship to the website. `SecurityWorkflowTests` and `CiWorkflowTests` fail the build if a workflow uses either one at any other commit.

## The web app's packages (npm)

The web app in `web/` and the API type generator in `tools/openapi-gen/` use packages from npm, the JavaScript package registry. They are under the same rules as the .NET packages, and they are free too.

- **Every npm pin has an entry.** `docs/dependencies.json` lists each package named in `web/package.json` and `tools/openapi-gen/package.json`: the normal packages, the development packages and the `overrides` (versions we force for a package that another package pulls in). An npm entry has `"kind": "npm"` and names its folder in `manifest` (`web` or `tools/openapi-gen`). The same package can sit in both folders at different versions. TypeScript does: 7.0.2 and 6.0.2 in `web/`, 5.9.3 in `tools/openapi-gen/`. zod is listed both as a normal package and as an override at the same version (4.6.7), like axe-core, so every copy in the tree, including the one chromium-bidi asks for, is 4.6.7. The test counts the two as one pin (D-65).
- **Exact versions only.** A range such as `^1.2.0` would let npm pick a newer version on its own, so the automated check fails on any range. An alias such as `"typescript": "npm:@typescript/typescript6@6.0.2"` is checked as the real package it installs (`@typescript/typescript6` 6.0.2).
- **What reaches the visitor's browser** is only the `runtime` and `font` packages: React, React Router, TanStack Query, nuqs, clsx, lucide-react, react-hook-form, zod, @hookform/resolvers and the two @fontsource fonts. Everything marked `build`, `test` or `tool` stays on the developer machine and the build server.
- **Cool-down exceptions are written down.** Five npm versions were adopted before they were 14 days old, each with the owner's approval and its reason in `coolDown`: vite 8.3.3 (it fixes three security problems, D-25), lucide-react 1.53.0 (the owner waived the wait for the icon package, D-11 and D-34), source-map-js 1.2.2 and http-cache-semantics 4.3.0 (security fixes for packages that other packages pull in, approved 2026-10-07), and zod 4.6.7 (a security fix, D-63, installed on 2026-10-26, a few hours before it turned 14 days old).
- **nuqs is installed.** It was approved on 2026-10-07 and installed in Phase 2 at 2.10.1. A newer 2.10.2 came out on 2026-10-08, so it is not 14 days old until 2026-10-22, and switching to it needs the owner's OK.

There is no separate `planned` list any more: everything approved so far is installed and in the main list.

**npm security fixes (approved 2026-10-26, D-63 to D-66).** The npm audit on pull request 11 reported known security problems, so the owner approved exact fixes. Three are pins: zod 4.6.7, vitest 5.0.4 and @vitest/coverage-v8 5.0.4. One top-level override, `"zod": "4.6.7"`, also forces the same zod onto chromium-bidi, a part of Lighthouse's browser driver that wanted the older zod 3 (D-65). Four more fixes only move inside the lockfile and are not pins, so they have no entry in `docs/dependencies.json`: undici 8.12.2 and 6.29.1, fast-uri 3.1.9 and ip-address 10.7.4. undici and fast-uri were younger than 14 days, and they skip the wait because they are security fixes (D-63). vitest 5.0.4 also needs newer versions of about a dozen test-only helper packages, which the owner accepted (D-66). None of them reaches the visitor's browser. One limit is accepted (D-65): chromium-bidi was written for zod 3, so with zod 4 a malformed command gives a generic TypeError instead of its own error message. Lighthouse never loads chromium-bidi, so nothing in the project reaches that code.

## Extra licenses for the web tools only (D-26)

The tools that build, test and check the web app pull in a few packages under licenses outside the five above. They are all free, and none of them reaches the visitor's browser. The owner approved them on 2026-10-07 (D-26) and 2026-10-08 (D-26 addendum). They are listed in `docs/license-exceptions.json` under `npmLicenseExceptions`, each with the kinds of tool it may be used for (`build`, `test` or `tool`).

| License | In plain words | Used by |
|---------|----------------|---------|
| MPL-2.0 | Free; changes to those files stay open | The CSS engine (lightningcss) and the accessibility checker (axe-core) |
| CC-BY-4.0, CC-BY-3.0 | Free data; credit the authors | Browser-support tables (caniuse-lite) and the license list of the license checker |
| CC0-1.0 | Public domain, no conditions | Language and CSS data, the license list |
| BlueOak-1.0.0, 0BSD, MIT-0 | Free and permissive, like MIT | File-matching and test helpers, a Lighthouse helper (tslib) |
| Python-2.0 | Free and permissive, like BSD | A command-line helper (argparse) of the API type generator |

`node web/scripts/license-gate.mjs` (also part of `npm run verify`) checks this on every run. The shipped web packages may use only the five licenses above plus OFL-1.1 for the two fonts. The tool packages may also use the licenses in this table, each only for the kinds of tool it lists. The gate fails if anything else appears, and also if an entry here is no longer needed, so the list stays honest. When license-checker could only **guess** a package's license (it marks the guess with `*`, often taken from a README line), the gate fails unless `docs/license-guesses.json` lists that exact `name@version` with the license the owner read and confirmed (`package`, `license`, `checked` date, `note`); an entry for a package no longer installed with a guessed license fails as stale. The file is an empty list today. `web/THIRD-PARTY-NOTICES.txt` lists every shipped web package with its full license text; it stays in the repository and is not published on the site (D-35).

## Adding a dependency

1. Record its purpose, license, maintenance status and a legitimacy check in the phase RESEARCH.md, and get the owner's OK.
2. Pin an exact version that is at least 14 days old: in `Directory.Packages.props` (or `.config/dotnet-tools.json` for a tool) for .NET, or in `web/package.json` (or `tools/openapi-gen/package.json`) for npm. npm already saves exact versions and refuses too-new ones (`web/.npmrc`).
3. Add an entry to `docs/dependencies.json`, keeping the list sorted by id. For npm, the id is sorted as `{manifest}:{id}`, for example `web:vite`. A bundled data file gets a `"kind": "data"` entry with its `source` (an https address pinned to a full commit SHA), `sha256` (lowercase) and repo-relative `path`.
4. Run `dotnet test --project tests/Csps.ArchitectureTests`. It fails if anything is missing, mismatched, unsorted, duplicated or under a license we do not allow.
5. For npm, run `npm --prefix web run license:check` and `npm --prefix web run notices`, and commit the updated `web/THIRD-PARTY-NOTICES.txt`. For .NET, run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1`. It checks the license of every package the new one pulls in, and regenerates `THIRD-PARTY-NOTICES.md`. Commit the updated notices. If it reports a package it does not allow, ask the owner first. Never widen `docs/allowed-licenses.json` or `docs/license-exceptions.json` to make it pass.
