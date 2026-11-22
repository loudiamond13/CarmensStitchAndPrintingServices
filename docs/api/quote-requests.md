---
created: 2026-11-22T16:32:00-06:00
updated: 2026-11-22T16:32:00-06:00
---

# The quote requests API

This is the contract behind the "Get a Quote" form on the Contact page (INQ-01). Everything here is under `/api/v1`. The OpenAPI
document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web app's
types are generated from it (`web/src/types/api.generated.ts`). This page covers what exists today: the anonymous create. Photos,
the staff inbox and the alert email come in later plans of Phase 13 and will be added here.

## In plain words

1. A visitor sends the form without signing in. The server saves it as a request at status New.
2. The server decides who made it, when, and its status. A visitor has no account, so the request has no creator (SEC-08). The
   request body cannot set a creator, a time, a status or an order link: such members are ignored.
3. Only the name and a Philippine mobile number are required. Everything else is optional.
4. Every limit counts UTF-16 code units after trimming, the same as the length of a string in JavaScript. An emoji counts as 2.
5. Limits match the order form, so a saved request always fits the New Order form later.
6. A retry with the same `Idempotency-Key` and the same body gets the stored answer and saves nothing more. Two different keys
   sent at once are two requests: nothing is merged.
7. The server never tells the caller how it guards against bots. A guarded request gets the same plain answer as a real one.

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `POST /public/quote-requests` | Anyone | the form below, with an `Idempotency-Key` | `200` `{ "id": "..." }`; `400 quote-requests.validation` with field errors; `429` |

## The form

| Field | Rule | Message when it fails |
|---|---|---|
| `customerName` | required, up to 100 | "Enter your name." / "Keep your name to 100 characters or fewer." |
| `teamName` | optional, up to 100 | "Keep the team name to 100 characters or fewer." |
| `contactNumber` | required, a Philippine mobile number: 11 digits starting 09, or +63 then 10 digits starting 9; spaces, dashes, dots and brackets are allowed; up to 30 characters typed | "Enter a mobile number, like 0917 123 4567." |
| `email` | optional, a real address, up to 254 | "Enter a valid email, like name@gmail.com" / "Keep the email to 254 characters or fewer." |
| `productChoice` | optional: `line`, `custom` or `not-sure` | "Choose a product from the list." |
| `productLineKey` | needed when `productChoice` is `line`: the key of a product line that is shown on the public site | "Choose a product from the list." |
| `quantity` | optional: `1-9`, `10-20`, `21-50`, `51-100` or `100+` | "Choose a quantity from the list." |
| `message` | optional, up to 2,000 | "Keep your message to 2,000 characters or fewer." |

Notes:

- The number is stored as E.164, such as `+639171234567`, built from the digits only.
- A `line` choice saves the line and its title at that moment (D-24). If the Manager later renames or deletes the line, the request
  keeps the title it was sent with.
- `custom` and `not-sure` save no line; a `productLineKey` sent with them is ignored.
- A hidden or unknown line key is a `400` on `productLineKey`.
- Empty optional text is stored as nothing.

## Answers

- `200` with `{ "id": "..." }`. The id names the new request. Nothing else about it is sent back.
- `400 quote-requests.validation` with an `errors` object: one array of messages for each field that failed, with the field names
  above. An empty or unreadable body lists the two required fields.
- `429` when one address sends too many. The limits arrive with the bot guards of a later plan.
