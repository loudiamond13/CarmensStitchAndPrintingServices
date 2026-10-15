---
created: 2026-10-15T11:30:00-05:00
updated: 2026-10-15T11:30:00-05:00
---

# The authentication and sessions API

This is the contract the web app uses to sign staff in and out, and the one a future Android app will use. Everything
here is under `/api/v1`. The OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the
machine-readable twin of this page; the types the web app uses are generated from it (`web/src/types/api.generated.ts`).

## In plain words

1. A person types an **email and password**. If they are right, the server emails a **6-digit code** and answers
   "check your email". The wrong-password answer is always the same, so nobody can find out which emails have accounts.
2. The person types the code. The server answers with a **15-minute access token** (kept in memory) and sets a
   **refresh cookie** the client cannot read. "Keep me signed in" decides how long the refresh cookie lasts: 90 days, or
   until the browser closes (and never more than 12 hours).
3. When the access token runs out, the client asks for a new one with the refresh cookie. Each refresh replaces the
   cookie. If an old cookie is ever used again, the server assumes it was stolen and ends that session.
4. A person can see where they are signed in, sign one device out, sign every other device out, or reset a forgotten
   password from an emailed link. A new staff member sets their first password from an emailed invite link.
5. Every step above writes one line to the append-only audit log.

An Android app follows the same steps. It keeps the access token **in memory only** and the refresh cookie in its
cookie jar, or the refresh token in secure storage if it handles the cookie itself.

## Who may call what

| Policy | Meaning |
|---|---|
| Anonymous | No access token needed. These calls read or set the two auth cookies, or carry a one-time link token in the body. |
| Staff | A valid access token (`Authorization: Bearer <token>`) of an `Admin` or `Manager`. |

Everything else in the API is denied by default; every action names its policy.

## Endpoints

All bodies are JSON. A call that creates or changes something needs the `Idempotency-Key` header unless it is on the
allow-list below. Errors are RFC 9457 problem details; the `code` field holds the machine code (see "Error codes").

### Sign-in

| Method and path | Policy | Body | Answers |
|---|---|---|---|
| `POST /auth/sign-in` | Anonymous | `{ "email", "password", "keepSignedIn" }` | `200 { "resendAfterSeconds" }` and the `__Secure-csps_2fa` ticket cookie (the code was emailed). `400` for malformed fields. `401` `auth.invalid-credentials` for every failure (wrong password, unknown email, locked or deactivated account). `429` over the limit. |
| `POST /auth/two-factor/verify` | Anonymous (ticket cookie, `X-CSPS-CSRF`) | `{ "code" }` | `200 { "next": "signed-in", "session": { ... } }` and the refresh cookie; or `200 { "next": "set-new-password", "reason": "temporary" \| "breach" }` and no session yet (see "Set a new password"). `400`, `401` `auth.ticket-expired`, `403` `auth.csrf-check-failed`, `429` `auth.code-lockout`. A wrong, used-up or expired code is `400` with `auth.code-wrong`, `auth.code-used-up` or `auth.code-expired` and the message under the `code` field. |
| `POST /auth/two-factor/resend` | Anonymous (ticket cookie, `X-CSPS-CSRF`) | none | `200 { "resendAfterSeconds" }`. `401`, `403`, `429` `auth.resend-cooldown` (with `Retry-After`) or `auth.resend-cap` (no wait time, D-10). |

A `session` is `{ accessToken, accessTokenExpiresAt, sessionExpiresAt, persistent, user: { id, email, firstName,
lastName, role } }`. The refresh token is never in a body.

### Session upkeep

| Method and path | Policy | Answers |
|---|---|---|
| `POST /auth/refresh` | Anonymous (refresh cookie, `X-CSPS-CSRF`) | `200` a new `session` and a new refresh cookie. `401` `auth.session-ended` when there is no live session, `403`, `409` `auth.session-busy` (two refreshes raced; try again). A refresh that arrives within 30 seconds of the previous one, with the old cookie, is let through once (the grace window for two tabs). |
| `POST /auth/sign-out` | Anonymous (refresh cookie, `X-CSPS-CSRF`) | `204`. Revokes this session and clears the cookie. Safe to repeat. |
| `POST /auth/sign-out-others` | Staff | `204`. Revokes every other session of the account, keeps this one (D-05). Always allowed, with or without other sessions (D-44). |
| `GET /sessions` | Staff | `200` an array of `{ id, device, signedInAt, lastActiveAt, persistent, current }`: the caller's own active sessions, at most 100. `device` is a coarse "Browser on Device" label of at most 60 characters. |
| `DELETE /sessions/{id}` | Staff | `200 { "alreadySignedOut" }`. `404` `sessions.not-found` for an id that is not the caller's; `422` `sessions.current` for the caller's own session; `409` `auth.session-busy`. Needs `Idempotency-Key`. |

### Forgot and reset a password

| Method and path | Policy | Body | Answers |
|---|---|---|---|
| `POST /auth/password/forgot` | Anonymous | `{ "email" }` | `202` for **every** address (AUTH-08), so nothing says whether an account exists. `400` for a malformed email. Needs `Idempotency-Key`. |
| `POST /auth/password/reset/check` | Anonymous | `{ "token" }` | `200 { "email" }` for a working link; `404` `auth.link-invalid` for anything else (expired, used, revoked, malformed, unknown). |
| `POST /auth/password/reset` | Anonymous | `{ "token", "newPassword" }` | `204`. Revokes every session of the account (D-19) and signs nobody in (D-17). `400` with the password message under `newPassword`, `404` `auth.link-invalid`, `409`. Needs `Idempotency-Key`. |

### Set a new password (must-change step)

| Method and path | Policy | Body | Answers |
|---|---|---|---|
| `POST /auth/password/set-new` | Anonymous (ticket cookie, `X-CSPS-CSRF`) | `{ "newPassword" }` | `200` a `session` and the refresh cookie: the password is saved and the sign-in finishes. `400` with the password message under `newPassword`, `401`, `403`. No session exists before this succeeds (D-13). |

### Invite

| Method and path | Policy | Body | Answers |
|---|---|---|---|
| `POST /auth/invite/check` | Anonymous | `{ "token" }` | `200 { "email", "firstName" }`; `404` `auth.invite-invalid`. |
| `POST /auth/invite/accept` | Anonymous | `{ "token", "newPassword" }` | `204`. Activates the account; the person then signs in with the emailed code (D-29). `400`, `404` `auth.invite-invalid`, `409`, `422` `auth.breach-check-unavailable` (the breach list could not be reached; this call fails closed, D-14, and nothing is saved). Needs `Idempotency-Key`. |

The password rule (D-11, `PasswordPolicy`): 8 to 64 characters with at least one number and one symbol, not on the
breached-password list, and without the person's name or email parts of 3 or more characters.

## The two cookies (D-38)

| Cookie | Holds | Lifetime |
|---|---|---|
| `__Secure-csps_2fa` | The pending-sign-in ticket between "password right" and "code right". | 30 minutes, then it is gone. |
| `__Secure-csps_rt` | The refresh token. | 90 days with "Keep me signed in"; otherwise a browser-session cookie, and the session ends after 12 hours at most. |

Both are `HttpOnly`, `Secure`, `SameSite=Strict`, scoped to `Path=/api/v1/auth`, and never readable by script. Renaming
or re-scoping the refresh cookie signs every device out once.

## The headers

| Header | Direction | Meaning |
|---|---|---|
| `Authorization: Bearer <accessToken>` | request | Needed by every Staff call. |
| `X-CSPS-CSRF: 1` | request | Needed by every call that reads an auth cookie: verify, resend, refresh, sign-out and set-new. A cross-site page cannot add it. Without it the answer is `403` `auth.csrf-check-failed`. A `Sec-Fetch-Site` header, when the browser sends one, must be `same-origin`. |
| `Idempotency-Key: <uuid>` | request | Needed by every `POST` and `DELETE` that changes something and is not on the allow-list. Send a fresh UUID per user action and **reuse it when you retry the same action**. The same key with the same body returns the stored answer; the same key with another body is `422` `idempotency.key-mismatch`; a duplicate while the first still runs is `409` `idempotency.in-progress`; a missing or non-UUID key is `400` `idempotency.key-missing`. |
| `Idempotent-Replayed: true` | response | The answer is the stored one from an earlier call with this key. |
| `Retry-After: <seconds>` | response | Sent with a `429` that has a wait time (the resend cooldown and the per-address limits). The hourly resend cap sends none. |

## Idempotency allow-list (D-40)

These endpoints are exempt from the `Idempotency-Key` gate, each for a written reason. `IdempotencyAllowList` in the
integration tests holds the same list and fails the build if an endpoint and its reason ever drift apart.

| Endpoint | Why a repeat must not be stored and replayed |
|---|---|
| `POST /auth/sign-in` | The answer sets a pending-login cookie and must never be stored; repeats are harmless and rate-limited. |
| `POST /auth/two-factor/verify` | The answer carries an access token and sets the refresh cookie; tokens must never be stored. |
| `POST /auth/two-factor/resend` | Bound to the ticket cookie; the 60-second cooldown and the hourly cap already make a repeat harmless. |
| `POST /auth/refresh` | Returns a new access token and rotates the cookie; it must never be stored or replayed. |
| `POST /auth/sign-out` | Naturally idempotent: a repeat finds nothing more to revoke. It clears the refresh cookie. |
| `POST /auth/sign-out-others` | Naturally idempotent: a repeat finds nothing more to revoke; no answer is worth storing. |
| `POST /auth/password/reset/check` | Read-only lookup; changes nothing. |
| `POST /auth/invite/check` | Read-only lookup; changes nothing. |
| `POST /auth/password/set-new` | The answer carries an access token and sets the refresh cookie; the pending ticket is single-use, so a repeat cannot set the password twice. |

## Lifetimes and limits

| What | Value | Where it is set |
|---|---|---|
| Sign-in code | 15 minutes, 5 tries | `AuthSettings` |
| Resend cooldown, resend cap | 60 seconds, 5 sends per hour | `AuthSettings` |
| Pending-sign-in ticket | 30 minutes | `AuthSettings` |
| Account pause after too many wrong codes | after 10 failures, for 15 minutes | `AuthSettings` |
| Access token | 15 minutes | `AuthSettings` |
| Session | 90 days ("Keep me signed in") or 12 hours (browser session) | `AuthSettings` |
| Refresh grace window | 30 seconds | `AuthSettings` |
| Reset link | 30 minutes, single use; at most 3 reset emails per hour per account | `AuthSettings` |
| Invite link | 72 hours, single use | `AuthSettings` |

Per-address limits (D-39, sliding window, configurable under `RateLimits:Auth`). A call over its limit gets `429`.

| Policy | Calls | Limit |
|---|---|---|
| `auth-sign-in` | sign-in | 10 per minute |
| `auth-verify` | verify code | 10 per minute |
| `auth-resend` | resend code | 5 per minute |
| `auth-forgot` | forgot password | 5 per 15 minutes |
| `auth-reset` | reset check, reset, set-new, invite check, invite accept | 10 per 15 minutes |
| `auth-refresh` | refresh, sign-out, sign-out-others, the devices list and sign-out of a device | 60 per minute |

## Error codes

| Code | Status | When |
|---|---|---|
| `auth.invalid-credentials` | 401 | Every failed sign-in, whatever the cause. |
| `auth.invalid-request` | 400 | Missing or malformed fields; field messages are under `errors`. |
| `auth.ticket-expired` | 401 | The pending sign-in is missing, unknown, closed or timed out. |
| `auth.csrf-check-failed` | 403 | A cookie-reading call without `X-CSPS-CSRF: 1` or from another site. |
| `auth.session-ended` | 401 | The refresh cookie has no live session. |
| `auth.session-busy` | 409 | A session change lost two races in a row; nothing changed; try again. |
| `sessions.not-found` | 404 | The device id is not the caller's, or does not exist. |
| `sessions.current` | 422 | A sign-out of the caller's own session was asked for. |
| `auth.code-wrong` | 400 | The emailed code is wrong. |
| `auth.code-used-up` | 400 | The code has no tries left. |
| `auth.code-expired` | 400 | The code is past its 15 minutes. |
| `auth.code-lockout` | 429 | The account is paused after too many wrong codes. |
| `auth.resend-cooldown` | 429 | A resend inside the 60-second cooldown; `Retry-After` says how long. |
| `auth.resend-cap` | 429 | The hourly resend cap; no wait time is given. |
| `auth.link-invalid` | 404 | A reset link that is malformed, unknown, used, revoked, expired or for an account that may not sign in. Never says which. |
| `auth.invite-invalid` | 404 | The same for an invite link. |
| `auth.breach-check-unavailable` | 422 | Invite acceptance only: the breached-password lookup could not be reached, so nothing is saved. |
| `idempotency.key-missing` | 400 | The key is missing or not a UUID. |
| `idempotency.key-mismatch` | 422 | The key was used with a different body. |
| `idempotency.in-progress` | 409 | The same key is still being processed. |

A `500` answer carries a `traceId`; the web app shows it as "Reference: {traceId}".

## Audit codes

Every step writes one append-only audit line (`dbo.AuditLog`, 8-month retention, IPs cut to /24 and /48). The codes are
in `AuditActions`; `docs/operations/audit-log.md` explains the log itself.

| Code | Written when |
|---|---|
| `auth.sign-in-failed` | A sign-in attempt failed; the detail says why. |
| `auth.lockout` | An account was locked after repeated failures; the detail says what triggered it. |
| `auth.2fa-issued` | A sign-in code was created and emailed. |
| `auth.2fa-resent` | A new sign-in code was requested. |
| `auth.2fa-verified` | A code was entered correctly. |
| `auth.2fa-failed` | A wrong code was entered. |
| `auth.2fa-exhausted` | A code ran out of tries. |
| `auth.signed-in` | A sign-in completed and a session started. |
| `auth.refresh-reuse-detected` | A used refresh token was presented again, so the session was revoked. |
| `auth.signed-out` | A person signed out of the current session. |
| `auth.sessions-revoked` | Several sessions were revoked at once (sign out other devices, a password reset). |
| `auth.session-revoked` | One session was revoked (sign out of a device). |
| `auth.password-reset-requested` | A password reset was asked for. |
| `auth.password-reset-completed` | A password reset finished. |
| `auth.password-reset-link-invalid` | A reset link that is unknown, expired or used was presented. |
| `auth.password-changed` | A signed-in person changed their own password. |
| `auth.password-breach-found` | A chosen password was refused for a breach, or a saved one was found in a breach at sign-in. |
| `auth.breach-check-unavailable` | The breached-password lookup could not be reached. |
| `auth.invite-accepted` | An invited person set a password and activated the account. |
| `user.bootstrap-manager-created` | The first Manager was created by the bootstrap command. |
| `user.invited` | A person was invited. |

## For a future Android client

- Send `X-CSPS-CSRF: 1` on the five cookie-reading calls, so the server treats the app like the web app.
- Keep the access token in memory. Never write it to disk or a log.
- Keep the cookies in a cookie jar that honours `Secure` and `Path=/api/v1/auth`, or read the refresh token from
  `Set-Cookie` into secure storage and send it back in a `Cookie` header on `/auth/refresh` and `/auth/sign-out`.
- Generate one `Idempotency-Key` per user action and reuse it on a retry of the same action.
- Treat `401` on a Staff call as "refresh once, then retry"; a `401` on refresh means sign in again.
