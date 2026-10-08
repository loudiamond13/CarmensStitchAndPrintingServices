---
status: diagnosed
trigger: "UAT G-02-2: GET http://localhost:5115/.vite/license.md returns 200 text/markdown (14,203 bytes, no-cache) after a production build; build internals must never be served from wwwroot."
goal: find_root_cause_only
created: 2026-10-08T04:05:00-05:00
updated: 2026-10-08T04:16:00-05:00
---

# Debug: wwwroot serves .vite/license.md

## Current Focus

known_pattern_candidate: none (no knowledge-base.md yet; MemPalace not available in this session, logged and skipped)
bug_class: Bohrbug (deterministic: same request, same 200 every time). SBFL skipped: no failing test exists (the suite never exercises the path).
hypothesis: CONFIRMED. H1 holds (leaf-only dot-prefix exclusion plus a known content type), and it is one half of an AND-gate with the Vite config that writes the file into the served root.
test: done (Development host on :5115, Production-environment scratchpad host on :5115, publish output, temporary probe files).
expecting: n/a
next_action: Return ROOT CAUSE FOUND to the orchestrator (diagnose only; no source edits).

reasoning_checkpoint:
  hypothesis: "/.vite/license.md is served because (a) vite.config.ts build.license:true with outDir = the API web root emits a build-metadata asset into wwwroot/.vite/, AND (b) UseStaticFiles (Program.cs:78) serves any existing file the web-root PhysicalFileProvider returns, and that provider's ExclusionFilters.Sensitive DotPrefixed check looks only at the leaf name (license.md), never at parent segments (.vite); .md is a known type (text/markdown), so the unknown-type 404 guard does not apply either."
  confirming_evidence:
    - "Development host: /.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md and /assets/../.vite/license.md all 200 text/markdown 14203 B."
    - "Probe files: /.probe.txt (dot leaf) 404; /.vite/manifest.json 200 application/json; /.hiddendir/sub/deep.txt 200 text/plain; /.vite/probe.unknownext 404."
    - "Production-environment scratchpad host with the same UseStaticFiles call: WebRootFileProvider = PhysicalFileProvider, filters Sensitive (7), GetFileInfo('/.vite/license.md').Exists = True, GET 200 text/markdown."
    - "dotnet publish output has no .vite/ (SDK DefaultExcludesInProjectFolder '**/.*/**'), and the same host over the publish wwwroot answers 404, so removing condition (a) from the served folder removes the symptom."
  falsification_test: "If a Production host over a web root containing .vite/license.md answered 404, or a file nested in any dot folder were hidden, H1 would be wrong. Both were tested and both returned 200."
  fix_rationale: "Diagnose only. A fix must remove (a) or (b); defence in depth removes (b) server-side so no future build by-product in a dot folder can leak, and an owner ruling on D-10 decides the fate of (a)."
  blind_spots: "Not tested on IIS/SmarterASP.NET (IIS request filtering does not deny .md by default and the aspNetCore handler takes path='*', so IIS would not block it if the file were deployed). The csproj glob <None Include='Fixtures\\webroot\\**'> copying a dot folder into the test output is not verified (needed for a regression fixture). Whether Rolldown rejects a license.fileName containing '..' is not verified."
  candidate_causes:
    - "config: vite.config.ts build.license:true + build.outDir '../src/Csps.Server/wwwroot' writes Vite build metadata into the served web root (CONFIRMED, condition a)"
    - "code: Program.cs UseStaticFiles has no path filter or allow-list; relies on PhysicalFileProvider's leaf-only DotPrefixed exclusion (CONFIRMED, condition b)"
    - "environment: Development static-web-assets composite provider is the cause (ELIMINATED: Production PhysicalFileProvider serves it too)"
    - "environment: dotnet publish deploys the file to the real host (ELIMINATED for today: publish drops **/.*/**; exposure is on every host that serves a raw build folder: dotnet run, E2E --webroot .e2e-dist, the 02-17 Lighthouse host)"
    - "data/test: fixture webroot never models Vite output and no negative test exists (CONTRIBUTING detection gap, not a cause of the 200)"
  and_gate: "yes. The 200 needs both (a) a typed non-app file nested in a dot folder inside the served web root and (b) a static-file pipeline that serves any existing typed file whose leaf name is not dot-prefixed. Removing either alone removes the symptom (proven: the publish output lacks (a) and returns 404). Both are recorded."

## Symptoms

expected: After a production build, the API serves only the app's files from wwwroot (index.html, hashed assets, mark.svg, robots.txt); build internals such as .vite/license.md are never served; a request for one gets the anonymous ProblemDetails 404.
actual: GET http://localhost:5115/.vite/license.md returns 200 text/markdown (14,203 bytes, Cache-Control no-cache) listing every bundled dependency with its exact version.
errors: None reported.
reproduction: `npm --prefix web run build` (production), `dotnet run --project src/Csps.Server --launch-profile http`, `curl -i http://localhost:5115/.vite/license.md`.
started: Since plan 02-01 enabled build.license (02-01 SUMMARY flagged "should be excluded by the dot-folder filter, but this is not verified"; 02-03 left it open for the Phase 3 deploy).

## Eliminated

- hypothesis: "ASP.NET Core's default physical file provider excludes dot-prefixed FOLDERS, so /.vite/license.md falls through to the {*path:file} 404" (the 02-01 SUMMARY assumption)
  evidence: ExclusionFilters.Sensitive (DotPrefixed|Hidden|System) is applied to the leaf FileInfo only. /.probe.txt is hidden (404) but /.vite/license.md, /.vite/manifest.json and /.hiddendir/sub/deep.txt are served (200).
  timestamp: 2026-10-08T04:10:00-05:00

- hypothesis: "Development-only behaviour (static-web-assets composite file provider under dotnet run)"
  evidence: A Production-environment host with the same UseStaticFiles call has a plain PhysicalFileProvider web root and still answers 200 text/markdown for /.vite/license.md.
  timestamp: 2026-10-08T04:11:00-05:00

- hypothesis: "The file is a required input that something consumes (third-party-notices.mjs / D-10 credits / plans 02-14..02-18)"
  evidence: third-party-notices.mjs reads the production npm tree via readTree(); repo-wide grep finds no reader of .vite/license.md; plans 02-14..02-18 never read it.
  timestamp: 2026-10-08T04:12:00-05:00

- hypothesis: "dotnet publish ships the file to the production host today"
  evidence: The publish output (scratchpad) has no .vite/ folder; SDK Microsoft.NET.Sdk.DefaultItems.targets:56 adds **/.*/** to DefaultExcludesInProjectFolder, and Publish.ComputeFiles.targets:57 includes wwwroot\** with that exclude. A host over the publish wwwroot answers 404. (Shielded by an SDK default only, not by the app.)
  timestamp: 2026-10-08T04:12:00-05:00

## Evidence

- timestamp: 2026-10-08T04:08:00-05:00
  checked: web/vite.config.ts lines 46-54
  found: build.outDir = '../src/Csps.Server/wwwroot' in production mode, emptyOutDir true, license true (comment "Writes .vite/license.md, the input for the third-party credits (D-10)"). No build.manifest, no ssr manifest.
  implication: Every production build drops Vite's own license list inside the API web root.

- timestamp: 2026-10-08T04:08:00-05:00
  checked: src/Csps.Server/wwwroot listing (left over from the UAT build, 03:59)
  found: wwwroot holds .vite/license.md (14,203 bytes), assets/ (fonts, index-*.js, index-*.css), index.html, mark.svg, robots.txt. .vite/ holds only license.md.
  implication: license.md is the only non-app file in the current production output.

- timestamp: 2026-10-08T04:09:00-05:00
  checked: src/Csps.Server/Program.cs line 78, Composition/SpaRegistration.cs, Endpoints/SpaHosting.cs
  found: app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply }) runs before UseRouting with no FileProvider, no ContentTypeProvider and no path filter; SpaCaching.Apply only sets Cache-Control (immutable for /assets, otherwise no-cache). The {*path:file} 404 fallback in SpaHosting only runs for files that UseStaticFiles did not answer.
  implication: Whatever the default web-root file provider returns as existing is served; nothing in the app filters dot segments. The no-cache header in the symptom comes from SpaCaching.Apply (path is not under /assets).

- timestamp: 2026-10-08T04:10:00-05:00
  checked: web/scripts/third-party-notices.mjs, web/scripts (grep), web/THIRD-PARTY-NOTICES.txt, repo-wide grep for "license.md" / ".vite/" outside node_modules
  found: third-party-notices.mjs builds the notices from readTree(webRoot, true) (license-checker over the production node_modules tree), never reads .vite/license.md; it only names the file in its HEADER text (line 27). No script, test, plan step or CI file reads .vite/license.md. web/.gitignore, .prettierignore and eslint.config.mjs only ignore .vite/.
  implication: Nothing consumes the file at build or runtime; it is an unused by-product.

- timestamp: 2026-10-08T04:10:00-05:00
  checked: committed web/THIRD-PARTY-NOTICES.txt vs the built .vite/license.md
  found: THIRD-PARTY-NOTICES.txt lists all 16 production packages incl. lucide-react@1.52.0 (ISC). The built license.md lists only 5 (archivo, barlow-condensed, react-dom, react, scheduler) because the tracer shell bundles nothing else yet.
  implication: The D-10 lucide-react credit is already carried by THIRD-PARTY-NOTICES.txt (repo file, not shipped in wwwroot). license.md is a narrower, build-dependent list.

- timestamp: 2026-10-08T04:11:00-05:00
  checked: 02-CONTEXT.md D-10, 02-RESEARCH.md line 517, STACK.md 197/301
  found: D-10 (owner): "Credit comes via the license notice pipeline (Vite build.license / THIRD-PARTY-NOTICES)." Research planned .vite/license.md as the THIRD-PARTY-NOTICES input; plan 02-03 implemented the notices from the npm tree instead.
  implication: Disabling build.license touches the wording of an owner decision (D-10); moving or filtering it does not.

- timestamp: 2026-10-08T04:12:00-05:00
  checked: plans 02-14..02-18 (grep license, wwwroot, .vite, outDir, readdir, publish)
  found: 02-15/02-16 only readdir wwwroot/assets for chunk names; 02-16 wires license:check and notices:check (license-gate.mjs / third-party-notices.mjs, npm tree) and writes artifacts/budget/budget.json outside wwwroot; 02-17 builds production into wwwroot and serves it on 5199 for Lighthouse; 02-18 forbids writing into wwwroot. None reads or relies on .vite/license.md.
  implication: Removing, relocating or filtering the file breaks no planned step.

- timestamp: 2026-10-08T04:13:00-05:00
  checked: tests/Csps.Server.IntegrationTests/Http/SpaHostTests.cs, tests/Csps.Testing/CspsApiFactory.cs (FixtureWebRoot, WebRootKey), tests/Csps.Testing/Fixtures/webroot (git ls-files)
  found: Every test host serves the committed fixture web root, which holds only index.html, assets/app-fixture.js and robots.txt. No dot-folder, no .md file, no mark.svg. No test requests a dot-segment path; MissingFileIsProblem404 covers /missing.js, /assets/missing.js, /favicon.ico; ExistingFileIsServed covers /assets/app-fixture.js.
  implication: The suite cannot see the bug: the fixture never models Vite's real output, and no test asserts "an existing non-app file is NOT served".

- timestamp: 2026-10-08T04:09:00-05:00
  checked: Reproduction. Preflight clean (5180/5115/7028/5199 free, no dev/test processes). `npm --prefix web run build` (production, 0 warnings, wwwroot/.vite/license.md re-emitted), `dotnet run --project src/Csps.Server --launch-profile http` (Development, :5115), curl.
  found: GET /.vite/license.md -> 200 text/markdown, 14203 B, Cache-Control no-cache, ETag, Accept-Ranges, full security headers, not compressed (text/markdown is not in SpaCaching.CompressibleTypes). HEAD -> 200. /.VITE/LICENSE.MD -> 200 (case-insensitive NTFS). /%2Evite/license.md -> 200 (decoded before lookup). /assets/../.vite/license.md (--path-as-is) -> 200 (normalized). /.vite -> 404 ProblemDetails ({*path:file}, last segment has a dot). /.vite/ -> 200 shell (non-file path, nothing leaked).
  implication: Symptom reproduced exactly; encoding and case variants do not help, so any fix must act on the decoded, normalized path, case-insensitively.

- timestamp: 2026-10-08T04:10:00-05:00
  checked: Temporary probe files in the git-ignored build output (deleted right after): wwwroot/.probe.txt, wwwroot/.vite/manifest.json, wwwroot/.vite/probe.unknownext, wwwroot/.hiddendir/sub/deep.txt
  found: /.probe.txt -> 404 ProblemDetails; /.vite/manifest.json -> 200 application/json; /.vite/probe.unknownext -> 404 ProblemDetails; /.hiddendir/sub/deep.txt -> 200 text/plain.
  implication: Confirms H1's prediction: the web-root provider's dot-prefix exclusion applies to the LEAF name only (a dot-named file is hidden, a normal file inside a dot folder is not); the only other guard is the content-type map (unknown extension -> 404). Any future .vite/* output with a known extension (manifest.json, ssr-manifest.json, license.json) would be served the same way.

- timestamp: 2026-10-08T04:11:00-05:00
  checked: Scratchpad host (outside the repo) with EnvironmentName = Production, WebRootPath = the real wwwroot, the same UseStaticFiles(StaticFileOptions{OnPrepareResponse}) call, on :5115 (this project's port, free after the API was stopped)
  found: WebRootFileProvider = Microsoft.Extensions.FileProviders.PhysicalFileProvider; default filters Sensitive (7); GetFileInfo("/.vite/license.md").Exists = True; GetFileInfo("/.vite").Exists = False; FileExtensionContentTypeProvider maps .md text/markdown, .json application/json, .txt and .map text/plain, .webmanifest application/manifest+json, .gz application/x-gzip, .br none. GET /.vite/license.md -> 200 text/markdown 14203 B; /%2Evite/license.md -> 200.
  implication: The real (non-Development) host serves it the same way; the cause is the framework's leaf-only filter plus the app's unfiltered UseStaticFiles, not a Development quirk.

- timestamp: 2026-10-08T04:12:00-05:00
  checked: `dotnet publish src/Csps.Server -c Release -o <scratchpad>/publish`; SDK 10.0.401 targets; probe host over the publish wwwroot
  found: Publish wwwroot = assets/, index.html, mark.svg, robots.txt plus SDK-generated .br/.gz siblings (index.html.br/.gz, mark.svg.br/.gz, robots.txt.br/.gz). No .vite/. Csps.Server.staticwebassets.endpoints.json has 0 "license" routes. Microsoft.NET.Sdk.DefaultItems.targets:56 DefaultExcludesInProjectFolder += **/.*/**; Publish.ComputeFiles.targets:57 <_WebProjectGeneratedContent Include="wwwroot\**" Exclude="...$(DefaultExcludesInProjectFolder)...">. Over the publish root: /.vite/license.md 404; /index.html.gz 200 application/x-gzip 449 B; /mark.svg.gz 200 application/x-gzip; /index.html.br 404.
  implication: A Web Deploy of the publish output would not carry the file today (an SDK default, not an app guarantee). Exposure today: every host that serves a raw build folder (dotnet run on wwwroot, the E2E host on web/.e2e-dist which also holds .vite/license.md, the 02-17 Lighthouse host). Side finding: the publish step puts precompressed .gz copies into the served root and UseStaticFiles serves them as application/x-gzip; same bytes as public files, so no disclosure, but they are "non-app files" relative to the UAT truth.

- timestamp: 2026-10-08T04:13:00-05:00
  checked: Built JS/CSS for license text; vite.config.ts for minify/legalComments
  found: 0 occurrences of "license"/"licence" and no /*! or @license comments in assets/index-*.js or index-*.css (minifier strips React's @license headers); no legalComments override.
  implication: Today the accidentally served .vite/license.md is the only third-party notice a site visitor can reach. Whether the public site must carry notices is part of the D-10 owner question, so it matters for the fix choice.

- timestamp: 2026-10-08T04:14:00-05:00
  checked: web/node_modules/vite/dist/node/chunks/node.js lines 34111-34160 (vite:license plugin); web/src/test/build-config.test.ts:12-18
  found: The plugin runs in generateBundle and calls this.emitFile({ fileName: build.license.fileName ?? ".vite/license.md", type: "asset" }); a .json fileName emits JSON. build-config.test.ts asserts expect(config.build?.license).toBe(true) (UAT row 21 "license on").
  implication: The license file is an ordinary bundle asset under outDir; relocating it outside wwwroot needs a small generateBundle/writeBundle step or a post-build move (a "../" fileName is likely rejected by the bundler; not verified). Turning build.license off also means changing the pinned build-config test.

- timestamp: 2026-10-08T04:15:00-05:00
  checked: git check-ignore for tests/Csps.Testing/Fixtures/webroot/.vite/license.md and a generic dot folder; root .gitignore
  found: Not ignored (only web/.gitignore ignores .vite/, and it applies under web/).
  implication: A regression fixture with a dot folder can be committed. Whether <None Include="Fixtures\webroot\**" CopyToOutputDirectory> copies it into bin/ still needs checking when the test is written.

## Resolution

root_cause: "AND-gate, two contributing causes: (1) config: web/vite.config.ts sets build.license: true with build.outDir '../src/Csps.Server/wwwroot', so every production (and e2e/budget) build emits Vite's bundled-dependency list as an asset at <web root>/.vite/license.md, a build internal that nothing consumes; (2) code: src/Csps.Server/Program.cs:78 app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply }) serves any file the default web-root PhysicalFileProvider reports as existing, with no path filter or allow-list. That provider's ExclusionFilters.Sensitive DotPrefixed rule checks only the leaf name (license.md), not parent segments (.vite), and FileExtensionContentTypeProvider maps .md to text/markdown, so StaticFileMiddleware answers 200 (Cache-Control no-cache from SpaCaching.Apply) before UseRouting, and the {*path:file} ProblemDetails 404 never runs. Detection gap: SpaHostTests runs only against tests/Csps.Testing/Fixtures/webroot (index.html, assets/app-fixture.js, robots.txt), which never models Vite's real output, and no test asserts that an existing non-app file is refused."
fix: "(diagnose only; not applied)"
fix_options:
  - "A (server, removes cause 2; no owner decision): refuse any request whose decoded Request.Path has a segment starting with '.', case-insensitive, before or inside the static-file pipeline, e.g. a StaticFileOptions.FileProvider wrapper that returns NotFoundFileInfo, so the request falls through to the existing {*path:file} ProblemDetails 404. Pros: defence in depth for every future dot-folder by-product (.vite/manifest.json, ssr-manifest.json, a stray .git/ or .well-known/ copy) on every host (dev, E2E, Lighthouse, IIS). Cons: a later deliberate /.well-known/ file (security.txt, an ACME challenge in wwwroot) would need an explicit carve-out. The check must use the decoded, normalized path (%2E and /assets/../ variants are served today)."
  - "A' (stricter variant): allow-list the served set (index.html, robots.txt, mark.svg, /assets/*), matching the UAT truth literally. Pros: also blocks non-dot by-products, such as the publish-generated .gz siblings. Cons: every later public file (PWA sw.js, manifest.webmanifest, icons) must be added to the list."
  - "B (build, removes cause 1; keeps the file): keep build.license but move the file out of the web root after the bundle step, with a small in-repo generateBundle/writeBundle step or a post-build move into a git-ignored artifacts/ folder. The fileName option alone is relative to outDir. Pros: keeps D-10's 'Vite build.license' wording and an exact bundled-only list. Cons: fixes only this one file, with no defence in depth, and adds build code."
  - "C (build, removes cause 1; drops the file): set build.license: false. The committed web/THIRD-PARTY-NOTICES.txt already lists a superset (16 production packages incl. lucide-react ISC), and nothing reads .vite/license.md. Cons: OWNER DECISION, because D-10 names 'Vite build.license / THIRD-PARTY-NOTICES' as the credit pipeline; it also changes the pinned web/src/test/build-config.test.ts:18 and the notices header text (third-party-notices.mjs:27, THIRD-PARTY-NOTICES.txt:10)."
  - "D (owner question behind B/C): the shipped JS has no license comments, so if the owner wants visitors to be able to read the third-party credits, publish a deliberate, named notices file or page (allow-listed), never a build internal in a dot folder. This is D-10 territory; not decided here."
  - "Regression guard (any option): add a fixture tests/Csps.Testing/Fixtures/webroot/.vite/license.md (not git-ignored; check the <None Include> glob copies it) and a SpaHostTests theory asserting 404 ProblemDetails for /.vite/license.md, /.VITE/LICENSE.MD, /%2Evite/license.md and a nested /.x/y.txt."
cwe: "CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor; in the CWE Top 25), more specifically CWE-538 (sensitive info in an externally accessible file) and CWE-497 (system information: exact dependency versions aid CVE fingerprinting). Impact is low: anonymous, read-only, no secrets, and the versions are partly inferable from the bundle."
verification: "(diagnose only)"
files_changed: []
