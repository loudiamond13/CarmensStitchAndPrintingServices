---
created: 2026-10-08T14:42:00-05:00
updated: 2026-10-13T06:35:00-05:00
---

# Calling the API from the web app

This page explains how the web app talks to the API (requirement WEB-04) and how the API's contract reaches the web app's types (decision D-16). It is written for every phase that adds an endpoint and the screen that uses it.

The short version:

- **Only `web/src/lib/api.ts` calls endpoints.** Screens and hooks call `api.<area>.<verb>()`. They never import `lib/http`, never call `fetch` and never use `XMLHttpRequest`. ESLint enforces this.
- **Types are generated, never hand-written.** Request and response types come from `web/src/types/api.generated.ts`, which is generated from a committed copy of the API's OpenAPI document.
- **Tests chain the live API, the snapshot and the types together.** If the API changes and the types are not refreshed, a test fails and says what to run.

## 1. The drift chain

The API's contract travels to the web app in three committed steps:

```text
the live API (Development /openapi/v1.json)
    -> tools/openapi-gen/openapi.v1.json       (the snapshot, checked by OpenApiSnapshotTests)
    -> web/src/types/api.generated.ts          (the types, checked by npm --prefix tools/openapi-gen run check)
    -> web/src/lib/api.ts                      (the calls, checked by tsc)
```

Each arrow has a check, so a change in one place cannot reach the next one silently:

| Check | What it compares | When it fails |
|-------|------------------|---------------|
| `OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument` (.NET integration tests) | The Development `/openapi/v1.json` with the committed snapshot, after normalization (key order and whitespace do not count) | An endpoint, DTO, property, description or status code changed. The message names the first differing JSON path, such as `$.components.schemas.SiteSettingsDto.properties.locale`. |
| `npm --prefix tools/openapi-gen run check` | The committed types with types freshly generated from the snapshot into a temporary file | The snapshot changed but the types were not regenerated, or someone edited the generated file. The message shows the first differing line. |
| `npm --prefix web run typecheck` | `api.ts` and every caller with the generated types | A call or screen still uses a renamed or removed property. |

### When you change the API

1. Make the API change (a new endpoint, a DTO change, a new status code).
2. Run the snapshot test. It fails and tells you to refresh the snapshot:

   ```bash
   dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"
   ```

3. Refresh the snapshot by setting the write switch **for this one command only**. Never set it at user or machine level (CLAUDE.md, shared machine rules):

   ```bash
   CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"
   ```

   The write run always fails on purpose ("Snapshot written ..."), so a CI job that sets the switch by mistake cannot pass. Run the command again without the switch, and it passes.

   In PowerShell, set the switch for one process like this: `$env:CSPS_WRITE_OPENAPI_SNAPSHOT='1'; dotnet test ...; Remove-Item Env:CSPS_WRITE_OPENAPI_SNAPSHOT`.

4. Regenerate the types:

   ```bash
   npm --prefix tools/openapi-gen run generate
   npm --prefix tools/openapi-gen run check
   ```

5. Update `api.ts` and its callers until `npm --prefix web run typecheck` is clean.
6. Commit the API change, `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` together.

Read the snapshot diff in review: it is the plain record of what the contract change was.

### Rules for the generated files

- **Never edit `web/src/types/api.generated.ts` by hand.** Prettier and ESLint skip it, and the check fails on any edit.
- **Never edit the snapshot by hand.** Refresh it with the write switch, so it always equals what the API serves.
- The snapshot comes from the **Development** host only. Production serves no OpenAPI document (D-14), and that stays true.
- The generator runs only in `tools/openapi-gen/`, with its own pinned `openapi-typescript` 7.13.0 and TypeScript 5.9.3. It never uses the web app's TypeScript. Install it with `npm --prefix tools/openapi-gen ci`.
- `npm --prefix tools/openapi-gen test` runs the check's own tests (Node's built-in test runner, no extra package).

## 2. The endpoint module, `api.ts`

`api.ts` exports:

- `api`: the app's API object, built once over one shared HTTP client, `createHttpClient({ baseURL: '/api/v1' })` (same-origin).
- `createApi(client)`: builds the same object over any client. Tests pass a client with a fake fetch (`createFakeFetch` from `web/src/test/fakeFetch.ts`).
- `Api` (the type of the object) and the response types it returns, such as `SiteSettings`.
- `HttpError`, `isHttpError` and `HttpErrorKind`, re-exported so screens can handle failures without importing `lib/http`.

### Groups

There is one group per area: `api.auth`, `api.orders`, `api.expenses`, `api.users`, `api.site`, `api.analytics`, `api.profile` and `api.inquiries`. All eight are declared now. In Phase 2 only `api.site` has a call:

```ts
const settings = await api.site.settings(signal); // GET /api/v1/site-settings, typed SiteSettings
```

### Adding a call

1. Build the endpoint and refresh the snapshot and types (section 1).
2. Export a type alias for each request and response schema from `components['schemas']`:

   ```ts
   export type OrderSummary = Schemas['OrderSummaryDto'];
   ```

3. Add the function to its group's type in `Api`, then implement it in `createApi`. Change the group from `PlannedGroup` to an object type when it gets its first call.
4. Follow these rules:
   - **Reads take an optional `AbortSignal`** as their last argument and pass it to the client. TanStack Query hands in its own signal (`useListQuery` calls `fetcher(params, signal)`).
   - **Query parameter names must not be secret-looking.** The client rejects `token`, `access_token`, `refresh_token`, `password`, `secret`, `otp` and `code` in a URL. Use, for example, `orderCode`, not `code`.
   - **An endpoint with no response body answers 204.** The client rejects any other 2xx that is empty, is not JSON or came through a redirect with an `HttpError` of kind `parse` (LIB-WR-05), so a captive portal or host page never resolves as the typed DTO. Type such a call as `Promise<void>`.
   - **Do not catch errors here.** Let `HttpError` reach the caller, which shows `error.message` (plain English) and the `traceId` for server errors.
5. Add a test to `web/src/lib/api.test.ts` that drives the call through `createApi` and a fake fetch. Check the method, the URL and the typed result.

### The Idempotency-Key rule (WEB-09)

Every POST function takes `{ idempotencyKey }` and passes it to the client:

```ts
create: (body: CreateOrderRequest, { idempotencyKey }: { idempotencyKey: string }) =>
  client.post<OrderDto>('/orders', body, { idempotencyKey }),
```

- **The key comes from the caller**, one per user submission. Screens get it from `useSubmission` (plan 02-16), which keeps the same key across a double click or a retry of the same submission. After a success, a trigger with the same data sends nothing and resolves with the same success (a double click that straddles a fast response, LIB-CR-01); changed data or `reset()` starts a new submission. Call `reset()` when the form is ready for a new entry, not inside `onSuccess`. Only plain JSON data is compared; a form whose data holds a `File`, `Blob`, `FormData`, `Map`, `Set` or `Date` passes the `identity` option (for an upload, the file's name, size and `lastModified` plus its other fields), or every submit gets a new key (LIB-CR-02).
- **The client never creates a key.** It sends the caller's key as the `Idempotency-Key` header and resends the same key on every retry and on the replay after a 401 refresh, so the server can recognise a repeat.
- A keyed POST may be retried after a network error or a 503. A POST without a key is never retried. A keyed request whose body is `FormData` is never retried by the client either: the browser picks a new multipart boundary on every send, so the retry would not be the same body (LIB-CR-02). The user retries it through `useSubmission`.

### One shared client

All calls share one client, so its behaviour holds across the whole app. When several calls get a 401 at the same time, the client runs **one** session refresh, and each call then retries once (WEB-03). `api.test.ts` proves this through `createApi`: three concurrent `api.site.settings()` calls that all get a 401 cause one refresh and three retries. If the refresh fails, all three reject with a 401 and the sign-out callback runs once.

Phase 4 passes the real `refresh` and `onUnauthorized` to the shared client when sign-in exists.

A call whose 401 is its own answer, not an ended session, passes `skipAuthRefresh: true` (LIB-WR-03): sign-in and 2FA verify (a wrong password), and the `refresh` call itself. Such a 401 rejects untouched, with no refresh, no retry and no `onUnauthorized`, and the screen shows its own message. The `refresh` function must send its own request this way: without it, a 401 on the refresh call would wait for its own refresh forever (LIB-WR-04).

A request sent before the last successful refresh whose 401 arrives late retries once with the new session, without starting a second refresh (LIB-WR-04). Where refresh tokens rotate with reuse detection, a second refresh could otherwise end the whole session.

## 3. Where things live

| File | Purpose |
|------|---------|
| `web/src/lib/api.ts` | The only module with endpoint calls |
| `web/src/lib/api.test.ts` | Its tests, over a fake fetch |
| `web/src/lib/http/` | The HTTP client (only `api.ts` and its test may import it) |
| `web/src/types/api.generated.ts` | The generated types (never edit) |
| `tools/openapi-gen/openapi.v1.json` | The committed OpenAPI snapshot (never edit by hand) |
| `tools/openapi-gen/check.mjs` | The type drift check |
| `tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs` | The snapshot test and its write switch |
