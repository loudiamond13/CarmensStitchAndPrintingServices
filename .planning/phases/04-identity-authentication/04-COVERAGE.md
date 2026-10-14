---
created: "2026-10-14T17:57:00-05:00"
updated: "2026-10-14T17:57:00-05:00"
phase: 04-identity-authentication
kind: api-coverage
---

# API Coverage: Phase 4 external services

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 4 talks to two outside services: the Have I Been Pwned password range API (breach check, AUTH-11, D-12, D-14) and the SmarterASP.NET SMTP server for the business mailbox no-reply@cspstailoring.com (AUTH-13, D-26). Both are free to use; the paid HIBP account APIs are out of scope under the free-only rule.

## Have I Been Pwned (api.pwnedpasswords.com and haveibeenpwned.com/api/v3)

| capability | decision | reason |
|---|---|---|
| pwned-passwords-range-sha1 | INTEGRATE | |
| pwned-passwords-add-padding | INTEGRATE | |
| pwned-passwords-range-ntlm | OPT-OUT | not needed: passwords are checked by SHA-1 prefix, the NTLM mode adds nothing for this app |
| breached-account-lookup | OPT-OUT | explicitly out of scope: needs a paid HIBP API key (free-only rule) and checks email addresses, not passwords |
| breaches-catalog | OPT-OUT | not needed: the app only checks whether a password appears in a breach |
| paste-account-lookup | OPT-OUT | explicitly out of scope: paid API key and not related to sign-in |
| domain-search-and-stealer-logs | OPT-OUT | explicitly out of scope: paid subscription features unrelated to password checks |

## SmarterASP.NET SMTP (MailKit)

| capability | decision | reason |
|---|---|---|
| smtp-starttls-submission | INTEGRATE | |
| smtp-ssl-on-connect | INTEGRATE | |
| smtp-authentication | INTEGRATE | |
| smtp-multipart-html-text-inline-image | INTEGRATE | |
| smtp-plain-unencrypted | OPT-OUT | explicitly forbidden: D-26 requires TLS, never an unencrypted connection |
| smtp-oauth2 | OPT-OUT | not needed: the SmarterASP mailbox uses username and password authentication |
| delivery-status-notifications-and-receipts | OPT-OUT | not needed: no tracking (D-30); failed sends are retried by the outbox (D-33) |
| inbound-mail-imap-pop | OPT-OUT | explicitly out of scope: the no-reply mailbox's replies are not read (D-26) |
