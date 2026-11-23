---
created: 2026-11-22T16:32:00-06:00
updated: 2026-11-23T06:43:00-06:00
---

# The quote requests API

This is the contract behind the "Get a Quote" form on the Contact page (INQ-01, INQ-02). Everything here is under `/api/v1`. The
OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web
app's types are generated from it (`web/src/types/api.generated.ts`). This page covers what exists today: the anonymous create and
the form ticket, the photo upload, the bot guards and the staff inbox reads. The request page, status changes and the alert email come in later plans of Phase 13 and will be added here.

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
8. Photos travel after the text, one photo per call (D-01, Pattern 1). The text is saved first, so a photo that fails never loses
   the request (D-03).

## Routes

| Method and path | Who | Body | Answers |
|---|---|---|---|
| `GET /public/quote-requests/ticket` | Anyone | none | `200` `{ "ticket": "...", "photoRules": { "maxPhotos": 5, "maxBytes": 10485760, "maxPixels": 25000000 }, "minimumSeconds": 3 }`, never cached; `429` |
| `POST /public/quote-requests` | Anyone | the form below, with an `Idempotency-Key` and the `ticket` | `200` `{ "id": "...", "photoSlots": [...] }`; `400 quote-requests.validation` with field errors; `400 quote-requests.ticket-expired`; `409 auth.session-busy`; `429 rate-limited` |
| `POST /public/quote-requests/{id}/photos/{slot}` | Anyone with the request's upload key | one multipart form with the file in the `file` part; headers `Idempotency-Key` and `X-Upload-Key` | `200` with no body; `400`; `404 quote-requests.photo-not-found`; `413`; `422 quote-requests.photo-refused`; `429`; `503` |

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
| `photos` | optional: the file names of up to 5 photos the visitor will send next, each up to 255 characters | "You can send up to 5 photos." / "Keep each photo file name to 255 characters or fewer." |
| `uploadKey` | required when `photos` is not empty: 32 random bytes made by the browser, written as base64url text (43 characters, no padding) | "Photos could not be attached. Try sending them again." |
| `ticket` | required: the ticket from the ticket call | `400 quote-requests.ticket-expired`: "The form timed out. Please send it again." |
| `subjectLine` | a hidden field no visitor sees; it must stay empty | none (see "Bot guards") |

Notes:

- The number is stored as E.164, such as `+639171234567`, built from the digits only.
- A `line` choice saves the line and its title at that moment (D-24). If the Manager later renames or deletes the line, the request
  keeps the title it was sent with.
- `custom` and `not-sure` save no line; a `productLineKey` sent with them is ignored.
- A hidden or unknown line key is a `400` on `productLineKey`.
- Empty optional text is stored as nothing.
- A `uploadKey` sent without `photos` is ignored and not stored.

## Photos

The create answer lists one place per declared file, in the order sent: `{ "id": "...", "photoSlots": [{ "slot": 0, "fileName":
"logo.png" }] }`. `photoSlots` is an empty list when no photo was declared. The answer never holds the upload key or anything else
secret. The file name is the name the visitor's browser reported, cleaned of folders and control characters.

The server keeps only the SHA-256 of the key and the time it stops working (`QuoteRequests:UploadKeyLifetime`, 2 hours by default,
from 5 minutes to 24 hours). A copy of the database cannot upload a photo.

Each photo is then posted to its own place: `POST /public/quote-requests/{id}/photos/{slot}`.

| Part | Rule |
|---|---|
| `Idempotency-Key` header | required, as for every POST |
| `X-Upload-Key` header | the same key the create call sent |
| `file` part | one photo: JPG, PNG, WebP or HEIC, read by its first bytes and never by its name or content type; at most 10,485,760 bytes; at most 25 megapixels and 10,000 pixels on the longest side |

The server removes the photo's location and camera data and keeps its pixels as sent (D-05). The file is stored in private storage
under `{root}/quotes/{id}/` with a random name, and the place is filled with one conditional update. A visitor has no account, so
the photo has no creator and no audit entry is written (SEC-08).

### Answers

| Status | When |
|---|---|
| `200` with no body | the photo is stored in its place |
| `400 images.file-missing` | there is no `file` part |
| `404 quote-requests.photo-not-found` | a wrong key, no key, a wrong or unknown request id, an expired key, a place that is already filled, a place that was not declared (including 5 and -1), or a request marked Spam |
| `413` | the file is over 10,485,760 bytes (one byte more than the limit) |
| `422 quote-requests.photo-refused` | the file is not a photo we can take: "{file name} isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger."; or it is over 25 megapixels: "{file name} is too big. Photos can be at most 25 megapixels." |
| `429` | too many uploads from one address, or the public photo pool is busy (see below) |
| `503 images.storage-failed` / `503 images.not-configured` | the photo storage did not take the file, or is not set up |

A visitor's photos have their own pool of upload places, apart from the places staff use for order and product photos (D-39).
By default 2 run at a time and 4 wait (`UploadSlots:Public:AtOnce`, 1 to 8, and `UploadSlots:Public:Waiting`, 0 to 20; a bad value
stops the start and the message names the setting, never the value). The next one at that moment gets `429 rate-limited` with
`Retry-After: 60`, and the visitor sends it again. However many visitors upload, staff photo uploads keep their own places. The place is
taken before the key is checked, which is why this pool is small.

Every `404` has the same body, so a caller cannot tell which part was wrong (CWE-639, CWE-203). Two photos for different places can
upload at the same time. Two photos for the same place give one `200` and one `404`; the second file is queued for removal.

### A failed photo is a missing photo (D-03)

The text is always saved first. When a photo fails for any reason, the request stays saved and that place stays empty, which staff
see as a missing photo. The visitor's next photo still works. A file that may have reached storage (a timeout, or a place that was
filled first) is queued for removal as `UploadUndone`, and the maintenance job removes it later.

## Bot guards (INQ-03)

There is no CAPTCHA, puzzle or challenge a visitor must solve (WCAG 3.3.8). Four quiet guards protect the inbox and the alert email.
They are layers, not walls. The ticket and the hidden field only stop simple bots. The real guard is the set of limits: per address,
for the whole site and per sender (see below, D-40). Every number is a setting, checked when the server starts. A bad value stops the start and the message names the setting, never
the value.

### The form ticket and the minimum time

The form asks for a ticket when it opens: `GET /public/quote-requests/ticket`. The ticket is made with Data Protection (purpose
`Csps.QuoteTicket.v1`), so the server signs and encrypts it and the browser cannot make or change one. It holds the time it was
issued. The answer also lists the photo rules the form checks before it sends a file (OR-3); they come from the server's own limits.
It carries `minimumSeconds` too (D-41): the value of `QuoteRequests:MinimumSeconds`, a whole number from 0 to 60. The form waits that
long after it gets the ticket before it sends, so raising the setting never makes real sends vanish.

The create call must carry the ticket in `ticket`.

A ticket is not single use and is not tied to a visitor, an address or an `Idempotency-Key` (D-40). It can be used for any number of sends
during its whole lifetime. So the minimum time is a one-time delay: a script that waits once after getting a ticket passes it for every
later send with that ticket. It stops only a bot that posts at once. Do not count on the ticket to stop repeated or scripted sends: the
limits per address, for the whole site and per sender do that.

| Case | Answer |
|---|---|
| A good ticket at least `QuoteRequests:MinimumSeconds` old (3 by default, 0 to 60) | the request is handled normally. A ticket exactly that old is accepted. |
| A ticket younger than that | `200` in the normal shape with a made-up id and the declared photo places. Nothing is saved. |
| A missing, changed, unreadable or too old ticket (`QuoteRequests:TicketLifetime`, 24 hours by default, 1 to 72 hours) | `400 quote-requests.ticket-expired`, with the message on the `ticket` field and a new ticket in `replacementTicket`. Nothing is saved. |

A real visitor who left the form open overnight gets the `400`, never a silent success (Pitfall 4). The `400` carries
`replacementTicket` (D-38): a ticket the server issued already `QuoteRequests:MinimumSeconds` old, and `minimumSeconds` (D-41), the same
whole number the ticket answer carries. The form sends the same body once
more at once, with that ticket in `ticket`, and the minimum time does not catch it. The resend needs a new `Idempotency-Key`, because the
body has changed. A bot gains nothing from this: it could already wait the minimum time after any ticket call. A ticket from
`GET /public/quote-requests/ticket` is still too young when it is used at once.

A send that is too fast is a silent `200` with a made-up id and nothing saved. A client must never cause one: it waits out
the `minimumSeconds` of the answer after it gets a ticket from the ticket call, and uses `replacementTicket` for the resend.

### The honeypot

`subjectLine` is a hidden field. When it holds text the answer is `200` in the normal shape with a made-up id and nothing is saved.
Browsers and password managers do not fill a field with this name. A field with only spaces counts as empty.

### What a caught send logs

A caught send (a filled `subjectLine`, or a ticket under the minimum time) writes one log line with a reason code and nothing else:
`honeypot` or `too-fast`. No address, name, number, email or text is logged (CWE-532). The owner can watch the count to see if
catches spike. An expired ticket is not a catch and writes nothing.

### Limits per address and for the whole site (D-26)

These limits and the per-sender limit below are the real guard against floods (D-40). The ticket and the hidden field are only a first filter.

| Setting | Default | Window | What it limits |
|---|---|---|---|
| `RateLimits:QuoteCreate` | 5 | 1 hour | creates from one address (an IPv6 address counts as its /64) |
| `RateLimits:QuoteCeiling` | 60 | 1 hour | creates from every address together |

Both sections have `PermitLimit` (at least 1) and `Window` (at least 6 seconds). The per-address window is taken first, so a refused create
never uses a ceiling permit. The answer is `429` with the code `rate-limited` and a `Retry-After` in whole seconds, rounded up, at least 1. The
per-address answer says "Too many attempts from this address. Please wait and try again." and the ceiling says "The site is busy. Please
try again in a minute." The ticket and photo routes keep their own limits. These two windows run before the body is read, so a replay with the
same `Idempotency-Key` still uses one permit in them; it is not saved again and not counted against the sender limit.

### Limit per sender (D-37)

One mobile number, or one email (compared without regard to case), can send `QuoteRequests:PerSenderPerDay` requests in 24 hours
(3 by default, 1 to 50). The count is by the stored E.164 number, so `0917 123 4567` and `+63 917 123 4567` are the same sender. A fourth
request answers the same `429 rate-limited` with a `Retry-After` for when enough earlier requests have left the 24 hours, and saves
nothing. Until the limit, requests with the same phone or email stay separate rows: nothing is merged. A request counts for exactly
24 hours (a request received 24 hours ago no longer counts).

The count and the insert run under the standing `quote-requests` lock row in one transaction, so two sends at once from one sender
never make a fourth row. A caught bot saves nothing, so it never counts. A replay with the same `Idempotency-Key` returns the stored
answer and is not counted again.

### Staff alert email (INQ-04, D-09)

When a Quote alerts address is saved in Site Content, each saved request queues one `QuoteAlert` email to that address in the same
transaction as the request, so a rolled-back request queues nothing. A caught bot and a refused sender queue nothing. No email goes to the
visitor. The email has the summary lines (name, team, phone, product, quantity, photos, first 300 characters of the message), a link to the
request in admin and no attachment. The subject is `New quote request from {name}`, the name cut at 60 characters; line breaks and control
characters in visitor text become one space, so no visitor text can add a header or a line.

At most `QuoteRequests:AlertsPerHour` alerts (20 by default, 1 to 200) go out in one business hour. The count runs under the same
`quote-requests` lock. The next request queues one `QuoteAlertsOverflow` email ("More quote requests are waiting") for that hour, and later
requests that hour are inbox only. The next hour starts again. Every request is saved either way. A send that fails is retried by the
email outbox and logged without the address or the content.

## Answers of the create call

- `200` with `{ "id": "...", "photoSlots": [...] }`. The id names the new request. Nothing else about it is sent back.
- `400 quote-requests.validation` with an `errors` object: one array of messages for each field that failed, with the field names
  above. An empty or unreadable body lists the two required fields (after the ticket is checked).
- `400 quote-requests.ticket-expired` when there is no good ticket. The answer holds `replacementTicket`, a ticket to use for one resend at once, and `minimumSeconds`, how long a client waits after any ticket.
- `409 auth.session-busy` "Something changed at the same time. Try again." when two sends collided twice, or the `quote-requests` lock was not had within 10 seconds. Nothing is saved; the visitor sends the same form again.
- `429 rate-limited` when one address sends too many, the whole site is busy, or one sender has sent too many.

## The staff inbox (INQ-05, D-13, D-14, D-18)

Both reads need a signed-in Admin or Manager. An anonymous caller gets `401`. They are never cached. The two roles see the same data.

| Method and path | Answers |
|---|---|
| `GET /quote-requests` | `200` a page of requests with the pill counts; `400 quote-requests.list-invalid` with field errors; `401` |
| `GET /quote-requests/new-count` | `200` `{ "count": 3 }`; `401` |

### The list query

| Parameter | Rule | Message when it fails |
|---|---|---|
| `status` | `open` (the default: New, Contacted and Quoted), `converted`, `closed`, `spam` or `all`; case and spaces around it do not matter | "Choose a status." |
| `q` | optional search text, up to 100 characters once trimmed | "Use 100 characters or fewer." |
| `page` | from 1 to 100000; 1 when not sent | "Use a page from 1 to 100000." |
| `size` | 10, 20, 50 or 100; 20 when not sent | "Use a page size of 10, 20, 50 or 100." |

Rows come newest received first. Two requests received at the same time come by id descending, so a page never repeats or skips a row.

### The search

- The name and the team match anywhere in the text, ignoring case. A typed `%`, `_` or `[` is plain text, not a wildcard.
- The phone is matched on its digits. The server keeps only the digits of `q`, drops a leading `63` or `0` when at least 3 digits are left, and looks for those digits inside the stored E.164 number. So `0917 123`, `917123` and `+63 917 123` all find `+639171234567`.
- Fewer than 3 digits is not a phone search, so one typed digit never matches every number.
- A search matches when the name, the team or the phone matches.

### The list answer

```json
{
  "items": [
    {
      "id": "...",
      "receivedAtUtc": "2026-11-20T08:00:00+00:00",
      "customerName": "Juan Dela Cruz",
      "teamName": "Brgy. San Roque Ballers",
      "contactNumber": "0917 123 4567",
      "product": { "choice": "line", "title": "Basketball Jerseys" },
      "quantity": "21-50",
      "photoCount": 3,
      "storedPhotoCount": 2,
      "photosRemoved": false,
      "status": "new"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "counts": { "open": 1, "converted": 0, "closed": 0, "spam": 0, "all": 1 }
}
```

- `teamName`, `product` and `quantity` are `null` when the visitor gave nothing. `product.title` is `null` for `custom` and `not-sure`.
- `contactNumber` is the display form. The email and the message are not in the list.
- `photoCount` is how many photos the visitor named. `storedPhotoCount` is how many arrived.
- `photosRemoved` is `false` until the Spam move exists (plan 13-16), which removes the photos.
- `total` counts the rows behind the current `status` and `q`, across all pages.
- `counts` is made by the server over the whole table. It ignores `q` and `page`, so a pill never changes while you type.
- The rows and the counts are read in separate commands without a lock. While someone changes a status, a pill can differ by one from the rows. The next refresh corrects it.

### The New count

`GET /quote-requests/new-count` answers the number of requests at status New. It is one number for every staff member: nothing is kept per person.
