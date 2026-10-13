---
phase: 02-web-foundation-design-system
lane: weblib
created: 2026-10-13T05:30:29-05:00
updated: 2026-10-13T05:30:29-05:00
reviewed: 2026-10-13T10:30:29Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - web/src/app/ErrorBoundary.tsx
  - web/src/app/Root.tsx
  - web/src/app/ShellFallback.tsx
  - web/src/app/admin/AdminLayout.tsx
  - web/src/app/admin/AdminPreviewPage.tsx
  - web/src/app/admin/TabBar.tsx
  - web/src/app/admin/admin.recipe.ts
  - web/src/app/admin/copy.ts
  - web/src/app/admin/routes.tsx
  - web/src/app/admin/sections.ts
  - web/src/app/admin/theme.ts
  - web/src/app/lazyRoute.ts
  - web/src/app/public/PublicLayout.tsx
  - web/src/app/public/PublicPlaceholderPage.tsx
  - web/src/app/public/SiteFooter.tsx
  - web/src/app/public/siteContact.ts
  - web/src/app/router.tsx
  - web/src/lib/api.ts
  - web/src/lib/csps.ts
  - web/src/lib/errors/describeHttpError.ts
  - web/src/lib/format.ts
  - web/src/lib/forms/focusFirstInvalid.ts
  - web/src/lib/forms/idempotencyKey.ts
  - web/src/lib/forms/useSubmission.ts
  - web/src/lib/http/HttpError.ts
  - web/src/lib/http/httpClient.ts
  - web/src/lib/query/keys.ts
  - web/src/lib/query/prefetchOnIntent.ts
  - web/src/lib/query/queryClient.ts
  - web/src/lib/query/useDebouncedValue.ts
  - web/src/lib/query/useListQuery.ts
  - web/src/lib/query/useSettledListParams.ts
  - web/src/lib/url-state/UrlStateLayout.tsx
  - web/src/lib/url-state/createListParams.ts
  - web/src/lib/url-state/defaultOptions.ts
  - web/src/lib/url-state/parsers.ts
  - web/src/main.tsx
  - web/src/styles/app.css
  - web/src/styles/base.css
  - web/src/test/axe.ts
  - web/src/test/axeTags.ts
  - web/src/test/consoleGuard.ts
  - web/src/test/fakeFetch.ts
  - web/src/test/setup.ts
  - web/src/types/react-css-custom-properties.d.ts
findings:
  critical: 2
  warning: 8
  info: 12
  total: 22
status: issues_found
---

# Phase 2: Code Review Report (lane: weblib)

**Reviewed:** 2026-10-13T10:30:29Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

This lane covers the web foundation libraries: the HTTP client and `HttpError`, `api.ts`, the order math and formatters (`csps.ts`, `format.ts`), submission and idempotency (`useSubmission`, `idempotencyKey`), error copy, TanStack Query conventions, nuqs URL state, the router, layouts and error boundaries, the dev admin shell, the global styles and the test helpers.

The order math in `csps.ts` agrees with `Csps.Domain.Orders.OrderMath` to the centavo. I traced the pinned operation order, half-away-from-zero rounding, exact BigInt fractions, the percentage on the rounded items total, and sum-then-round for payments and expenses, and found no money defect there. `newIdempotencyKey` is a correct v4 UUID from a CSPRNG.

The serious defects are in the **submission and idempotency layer**, which WEB-09 and SEC-06 rely on to stop duplicates:

1. After a fast success, the hook issues a new key. So a double-click whose second click lands after the response creates a second record.
2. JSON comparison treats every `FormData`, `File`, `Blob`, `Map` and `Set` as `"{}"`, so the hook reuses a key for a different payload. Under SEC-06's body-hash rule (a multipart boundary differs on every send), an upload form that fails once is then stuck on 422 for good.

Other problems:

- **Key reuse after a definitive rejection:** the hook also reuses the key after a final 4xx, which SEC-06 replays from its stored response for 24 hours.
- **Silent 400 field errors:** a 400 with field errors produces no feedback at all when no rendered field matches.
- **401 contract traps:** every 401 is silent, and the refresh path is re-entrant.
- **Untyped 2xx bodies:** a non-JSON 2xx body is returned typed as the DTO.
- **Pasted money:** a pasted amount can be inflated 100x.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A double-click that straddles a fast success creates a duplicate record (new key after success)

**File:** `web/src/lib/forms/useSubmission.ts:104-116, 130-139`
**Issue:** The in-flight guard (`inFlightRef`) covers only the time the request is pending. When a submission succeeds, `run` clears `inFlightRef` and `pending`, and `failedRef` stays `undefined`. The next `submit` then always takes `newIdempotencyKey()` (line 104). On a LAN or localhost, or with any fast endpoint, the response can arrive in about 30–80 ms, well inside a normal double-click interval (100–250 ms).

The sequence:
- Click 1 creates key A, the POST succeeds and `pending` drops back to false.
- Click 2 arrives before `onSuccess`'s navigation commits or the form unmounts. The public layout keeps the form mounted while the next route's lazy chunk loads.
- Click 2 creates key B and sends a second POST.

The server's SEC-06 store cannot dedupe two different keys, so a second order, payment, expense or inquiry is created. This breaks the hook's own contract ("A double-click, a second Enter or a retry must never create two orders, payments or expenses", lines 1-2) and WEB-09/SEC-06.
**Fix:** Bind the key to the data across a success as well. Only `reset()` or changed data starts a new key, so a same-data resubmission replays the server's stored response instead of creating a record:
```ts
interface LastSubmission { readonly key: string; readonly serialized: string; readonly succeeded: boolean }
const lastRef = useRef<LastSubmission | undefined>(undefined);
// in run():
const last = lastRef.current;
const key = last !== undefined && serialized !== undefined && last.serialized === serialized
  ? last.key
  : newIdempotencyKey();
// after the outcome (success or failure):
lastRef.current = serialized === undefined ? undefined : { key, serialized, succeeded: outcome.ok };
// reset(): lastRef.current = undefined;
```
Alternatively, keep `pending` (or a `submitted` latch) true after success until the caller calls `reset()` or the component unmounts. Add a test in which the fake `send` resolves at once and two `submit()` calls are separated by a resolved microtask or macrotask.

### CR-02: Every FormData, File, Blob, Map or Set payload compares equal, so a key is reused for a different body, and an upload form gets stuck on 422

**File:** `web/src/lib/forms/useSubmission.ts:54-65, 104, 118`; `web/src/lib/http/httpClient.ts:385-393, 426`
**Issue:** `serialize` treats `JSON.stringify(data)` as the identity of a submission. `JSON.stringify(new FormData())`, `JSON.stringify(file)`, `JSON.stringify(new Map(...))` and `JSON.stringify(new Set(...))` all return `"{}"`, and an object holding a `File` serializes the file as `{}`. Two consequences:

1. **A different payload reuses the old key.** If an image upload fails and the user picks a different file, line 104 reuses the old key. Under SEC-06 (REQUIREMENTS.md: "the same key with a different body gets a 422"), the retry fails with 422. Worse, if the first attempt actually committed (a client timeout), the server returns the stored 201 of the *old* image and the UI reports success for an image that was never saved.
2. **The form is stuck permanently.** A multipart body gets a new random boundary on every send, so even the *same* file produces a different SHA-256 body hash. After any ambiguous failure, every retry gets 422. Line 118 then stores the same `{key, serialized: "{}"}` again, so the hook never rotates the key: the form cannot succeed until `reset()` or a remount. The HTTP client has the same problem on its own retries: `canRetry` (line 426) retries a key-carrying FormData POST after a network error, and that retry also re-encodes the multipart body.

`httpClient` explicitly supports `FormData` and `onUploadProgress` for exactly these upload flows (order images, Cloudinary). `useSubmission` is declared the one submission path for every form.
**Fix:** Refuse to treat non-plain data as comparable. Then rotate the key for such payloads, or require an explicit identity from the caller:
```ts
function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(isPlainJson);
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Object.values(value).every(isPlainJson);
}
function serialize(data: unknown): string | undefined {
  if (data === undefined) return NO_DATA;
  if (!isPlainJson(data)) return undefined; // FormData/File/Blob/Map/Set/Date: never "the same submission"
  try { return JSON.stringify(data); } catch { return undefined; }
}
```
Also add an optional `identity?: (data: TData) => string` option, so an upload can key on, for example, `file.name + file.size + file.lastModified`. Then either make the server's SEC-06 hash multipart-boundary-independent (hash the parts), or have the client's `canRetry` exclude `FormData` bodies. Record that decision in the plan.

## Warnings

### WR-01: The key is reused after definitive 4xx rejections, which SEC-06 replays for 24 hours

**File:** `web/src/lib/forms/useSubmission.ts:117-118`
**Issue:** After *any* failure, the hook keeps the key for the next same-data submission. Key reuse is only correct when the outcome is ambiguous: a network error, a timeout, an abort mid-flight, a 5xx, or SEC-06's "still running" 409. In those cases the server may have committed, and the replay must land on the stored result.

A 400, 403, 404, 422 or 429 is final. SEC-06 stores "the response status and body" for 24 hours and replays it for the same key and body. So:
- A same-data retry after a server-state-dependent 400 (for example "payment exceeds balance", fixed meanwhile by another staff member) replays the stale 400 until the user edits a field.
- After a 429 "Wait a minute, then try again", waiting does not help if the server stored the 429.
- After a 422 key mismatch, the hook re-stores the same key, so it never recovers.
**Fix:** Set `failedRef` only for ambiguous failures:
```ts
const ambiguous = !isHttpError(err) || err.kind !== 'http' || err.status >= 500 || err.status === 409;
failedRef.current = ambiguous && serialized !== undefined ? { key, serialized } : undefined;
```
Add a test for each class.

### WR-02: A 400 with field errors gives no feedback when no rendered field matches the server's key

**File:** `web/src/lib/forms/useSubmission.ts:119-125`; `web/src/lib/errors/describeHttpError.ts:18-19, 59-61`
**Issue:** When `fieldErrors` is non-empty, `copy` is forced to `null`, so `onFailure` never runs. The `checkFields` copy that describeHttpError defines ("Check the highlighted fields.") therefore never reaches a form. Server keys come back "in the server's casing" (for example `Amount`, `Items[0].UnitPrice`, `RowVersion`, `$.amount` from a JSON binding error). If no rendered field matches one, nothing is highlighted, no banner appears, and `focusFirstInvalid` returns false. The user sees the button stop spinning and nothing else.
**Fix:** Always call `onFailure` with `describeHttpError(error)`, which already returns `checkFields` for this case and lets the caller decide. Alternatively, return an `unmatchedFieldErrors` list so a form can render the leftover messages in the banner.

### WR-03: Every 401 is silent: no copy, no callback, nothing wired in Phase 2, and no per-request opt-out

**File:** `web/src/lib/errors/describeHttpError.ts:56-58`; `web/src/lib/http/httpClient.ts:481-488`; `web/src/lib/api.ts:57-58`
**Issue:**
- **Silent failure today:** `describeHttpError` returns `null` for every 401, on the premise that "the sign-in redirect takes over". But the shared client is built with no `refresh` and no `onUnauthorized` (api.ts:58), so in Phase 2 nothing takes over. A 401 shows nothing: `useSubmission` skips `onFailure`, and ConfirmDialog sets `failure` to `null`.
- **Wrong sign-out later:** `execute` sends *every* 401 into refresh or `onUnauthorized`, including a 401 that is a legitimate answer, such as the Phase 4 sign-in or 2FA-verify endpoint rejecting a bad password. With the current design, that 401 triggers a refresh attempt and then the global sign-out callback, and the form shows no message.
**Fix:**
- Add `readonly skipAuthRefresh?: boolean` to `RequestOptions`. `execute` rethrows such a 401 untouched.
- Give `describeHttpError` an explicit 401 copy ("Your session ended. Sign in again."), used whenever the error is not consumed by the client's `onUnauthorized` path. For example, mark consumed errors with an `HttpError.handledBySession` flag, or let `describeHttpError` take an option.

### WR-04: The refresh single flight deadlocks if `refresh` uses the same client, and a stale 401 starts a second refresh

**File:** `web/src/lib/http/httpClient.ts:458-505`
**Issue:**
1. **Deadlock.** The docs and `api.ts` (lines 12, 57) say Phase 4 passes the real `refresh` to "the shared client". If `refresh` calls `/auth/refresh` through that same client and the refresh request itself gets a 401:
   - `execute` → `joinRefresh` returns the cycle already in flight;
   - `await cycle.done` waits on `refresh()`, which waits on this same request, so it never settles;
   - every queued 401 hangs forever and `onUnauthorized` never runs.
2. **Second refresh.** A request sent with the old credentials can return its 401 *after* the cycle has finished and `refreshCycle` is back to `undefined` (line 471). It then starts a second refresh. With rotating refresh tokens and reuse detection, the second refresh can revoke the whole session.
**Fix:**
- Mark requests issued inside `refresh` (the `skipAuthRefresh` from WR-03) so that they never join a cycle.
- Record a monotonically increasing `sessionEpoch` that each request captures at send time. A 401 from a request whose epoch is older than the last successful refresh retries directly, without a new refresh.
- Add tests for both cases.

### WR-05: Non-JSON or empty 2xx bodies resolve as the typed DTO

**File:** `web/src/lib/http/httpClient.ts:334-339, 533`; `web/src/lib/api.ts:49`
**Issue:** `toHttpResponse` returns `data: text` for any 2xx with a non-JSON Content-Type, and `data: undefined` for an empty body. `request<T>` then casts it with `response.data as T`, so `api.site.settings()` can resolve with an HTML string or `undefined` typed as `SiteSettings`. Real triggers:
- captive portals and carrier interstitials on PH mobile networks;
- a reverse proxy or host login page reached through a followed redirect (fetch follows 3xx silently, and `response.redirected` is never checked);
- a 204 from an endpoint the caller types as an object.

Consumers then read `undefined` fields with no error, so a "parse" failure surfaces as a crash or a blank screen far from the cause.
**Fix:** Since the client always sends `Accept: application/json`, treat a non-empty 2xx body whose Content-Type is not JSON as `new HttpError({ kind: 'parse', status })`. Also treat `response.redirected === true` on an `/api` call as a parse or network failure. Keep `undefined` only for 204/205, and type such endpoints as `Promise<void>` in `api.ts`.

### WR-06: `normalizePastedMoney` strips commas anywhere, so "1,50" becomes ₱150.00 (100x)

**File:** `web/src/lib/format.ts:86-89`
**Issue:** `text.replace(/[\s,]/g, '')` removes every comma without checking that the commas are thousands separators in valid positions. These pastes are silently accepted as a different amount:
- "1,50" or "12,5" (decimal-comma text, common in spreadsheets and phone keyboards set to other locales) become 150 and 125;
- "1,2,3" becomes 123.

Money entry is part of the Core Value. A 100x inflation on a payment or expense passes `MONEY_TEXT` and reaches the server as a valid amount.
**Fix:** Accept commas only as proper groups, and reject anything else:
```ts
const GROUPED = /^\d{1,3}(,\d{3})+(\.\d{0,2})?$/;
const compact = text.replace(/\s/g, '');
const candidate = compact.includes(',') ? (GROUPED.test(compact) ? compact.replace(/,/g, '') : '') : compact;
return MONEY_TEXT.test(candidate) ? candidate : '';
```

### WR-07: `csps.formatDate` reads the machine's time zone for timestamps

**File:** `web/src/lib/csps.ts:169-177`
**Issue:** For any input that is not exactly 10 characters (an API instant such as `2026-10-06T16:30:00Z`), `new Date(d)` plus `getMonth()`, `getDate()` and `getFullYear()` format in the *browser's* zone, not Asia/Manila. A staff laptop set to another zone shows the wrong calendar day. `format.ts` states "Nothing here reads the machine's zone", and `OrderCard.tsx:15` explicitly avoids this function for that reason. It is still exported from the module whose header says "every figure shown wherever an order appears comes from" it, and nothing marks it as unsafe.
**Fix:** Remove `formatDate` from `csps.ts`, or re-implement it as a thin wrapper:
```ts
export const formatDate = (d: string | null | undefined): string =>
  !d ? '—' : d.length === 10 ? formatCalendarDate(d) : formatBusinessDate(d);
```

### WR-08: The CWE-598 secret-parameter guard can be bypassed through the URL string

**File:** `web/src/lib/http/httpClient.ts:188-203`
**Issue:** `assertNoSecretParams` inspects only `params`. `buildUrl` accepts a query already in `request.url` (it appends with `&` when `url.includes('?')`). So `client.get('/auth/confirm?token=abc')` or `client.post(\`/x?code=${otp}\`)` passes the guard, and the secret lands in server logs, history and Referer, which is exactly what the guard documents it prevents.
**Fix:** Parse the query of the final URL and check every key:
```ts
const finalUrl = buildUrl(baseURL, prepared);
const query = finalUrl.split('?')[1] ?? '';
for (const name of new URLSearchParams(query).keys()) {
  if (secretParams.has(name.toLowerCase())) throw new TypeError(/* same text */);
}
```
Alternatively, reject any `?` in `request.url`.

## Info

### IN-01: Programming errors are classified as `network`, retried and masked

**File:** `web/src/lib/http/httpClient.ts:216-227`; `web/src/test/fakeFetch.ts:83-85`
**Issue:** `toTransportError` maps every non-HttpError thrown by the transport to `kind: 'network'`. The cases this covers include fetch's TypeError for a GET or HEAD with a body, an invalid URL, and the fake fetch's "no planned response" error. GET, PUT and DELETE then retry twice, and the user sees "Couldn't reach the server". In tests, an unexpected extra request turns into a generic network error instead of the fake's descriptive message, so the failure is harder to read.
**Fix:** Classify as `network` only for `TypeError` from the fetch call, rethrow anything else unchanged, and reject a `body` on GET or HEAD in `initialRequest`.

### IN-02: `defaultSleep` ignores a signal that is already aborted

**File:** `web/src/lib/http/httpClient.ts:132-143`
**Issue:** An `abort` event that has already fired is not re-dispatched. If the caller aborts between a failed attempt and the backoff, the wait runs to completion, and then one more doomed attempt starts.
**Fix:** `if (signal?.aborted) { reject(new DOMException(..., 'AbortError')); return; }` at the top.

### IN-03: A `__proto__` field name in the ProblemDetails `errors` member changes the object's prototype

**File:** `web/src/lib/http/HttpError.ts:86-92`
**Issue:** `errors[field] = ...` on a `{}` literal with `field === '__proto__'` (an own key after `JSON.parse`) sets the prototype instead of a property. The field error is lost, and `errors` inherits array members. The effect is local, but it is avoidable.
**Fix:** Use `const errors: Record<string, readonly string[]> = Object.create(null)`, or skip `__proto__`, `constructor` and `prototype`.

### IN-04: `formatBusinessDate` can throw on a string that passes the regex

**File:** `web/src/lib/format.ts:47-50`
**Issue:** INSTANT allows up to 9 fractional digits (.NET emits 7). ECMAScript defines only 3, so parsing more is implementation-defined. If an engine returns Invalid Date, `Intl.DateTimeFormat.format` throws a RangeError during render instead of returning "—".
**Fix:** `const date = new Date(utcIso); if (Number.isNaN(date.getTime())) return EMPTY;`, or trim the fraction to 3 digits before parsing.

### IN-05: `clampPage` with a non-finite page count writes `page=NaN` to the URL

**File:** `web/src/lib/url-state/parsers.ts:112-115`; `web/src/lib/url-state/createListParams.ts:169-175`
**Issue:** `clampPage(page, NaN)` returns NaN, `target !== page` holds, and the hook writes NaN. The normalization effect then strips it, and the next clamp can write it again (URL flapping) if a response is missing `totalPages`.
**Fix:** `if (!Number.isFinite(totalPages)) return;` in the setter, and `Number.isFinite` guards in `clampPage`.

### IN-06: `useSettledListParams` compares with `Object.is`, so an array or object parser value would loop renders

**File:** `web/src/lib/query/useSettledListParams.ts:19-32`
**Issue:** If a list ever adds a parser whose value is not referentially stable (for example `parseAsArrayOf` for multi-select status), `sameValues` is false on every render. `setHeld` during render then re-renders without end ("Too many re-renders"). No such parser exists today.
**Fix:** Compare by each parser's `eq`, or by `JSON.stringify` of the values. Document the restriction in `createListParams` if it stays.

### IN-07: The default 30 s per-attempt timeout also applies to XHR uploads, and a timeout is never retried

**File:** `web/src/lib/http/httpClient.ts:402-406, 423`
**Issue:** A multi-MB jersey mockup over a slow mobile link can take longer than 30 s while progress is still moving. The upload then fails as "Couldn't reach the server".
**Fix:** For requests with `onUploadProgress`, use a much larger default, or reset the timer on each progress event (an idle timeout).

### IN-08: The SEC-06 "duplicate still running" 409 gets the rowversion-conflict copy

**File:** `web/src/lib/errors/describeHttpError.ts:27`
**Issue:** "Someone else changed this. Reload to see the latest version…" is misleading for an idempotency in-flight 409 on a create.
**Fix:** Distinguish the two by the ProblemDetails `type` the server sets, and show "Still saving your last attempt. Wait a moment, then try again."

### IN-09: Reduced motion zeroes only transitions; keyframe animations keep running

**File:** `web/src/styles/base.css:184-188`
**Issue:** `csp-shimmer`, `csp-spin`, `csp-rise` and `csp-slide` still animate under `prefers-reduced-motion: reduce`.
**Fix:** Add `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;` there, or exempt only the spinner explicitly.

### IN-10: `HttpError.message` carries server-written text

**File:** `web/src/lib/http/HttpError.ts:46-49`
**Issue:** The message is the server's ProblemDetails `title`. describeHttpError guarantees that no server text reaches the screen, but any future code that renders or logs `error.message` (an error boundary using `useRouteError`, a toast fallback) breaks that guarantee (CWE-209).
**Fix:** Keep the server title in `problem.title` only, and make `message` always the fixed default for the kind.

### IN-11: The dev route `/dev` has no index route, and the admin preview never restores `document.title`

**File:** `web/src/app/admin/routes.tsx:44-57`; `web/src/app/admin/AdminPreviewPage.tsx:21-23`
**Issue:** `/dev` matches the `dev` branch and renders the admin shell with an empty `main`. After leaving an admin preview, the tab keeps "{Section} · CSPS Admin".
**Fix:** Add `{ index: true, loader: () => redirect('/dev/components') }`, and return a cleanup from the effect that restores the previous title.

### IN-12: The component axe helper runs WCAG tags only, so best-practice rules are skipped

**File:** `web/src/test/axe.ts:22-25`; `web/src/app/public/SiteFooter.tsx:51, 63, 76`
**Issue:** `runOnly` by WCAG tags excludes `heading-order`, `region`, `landmark-*` and the other best-practice rules. As a result, the footer's `h4` directly after the page's `h1` is never flagged, although the project bar is "zero axe violations".
**Fix:** Add `'best-practice'` to `AXE_TAGS`, or explicitly enable `heading-order` and `region`. Use `h2` for the footer column headings.

---

_Reviewed: 2026-10-13T10:30:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
