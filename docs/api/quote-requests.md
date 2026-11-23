---
created: 2026-11-22T16:32:00-06:00
updated: 2026-11-22T18:05:00-06:00
---

# The quote requests API

This is the contract behind the "Get a Quote" form on the Contact page (INQ-01, INQ-02). Everything here is under `/api/v1`. The
OpenAPI document (Development only, at `/openapi/v1.json`, viewer at `/scalar`) is the machine-readable twin of this page; the web
app's types are generated from it (`web/src/types/api.generated.ts`). This page covers what exists today: the anonymous create and
the photo upload. The staff inbox and the alert email come in later plans of Phase 13 and will be added here.

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
| `POST /public/quote-requests` | Anyone | the form below, with an `Idempotency-Key` | `200` `{ "id": "...", "photoSlots": [...] }`; `400 quote-requests.validation` with field errors; `429` |
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
| `429` | too many uploads from one address, or the whole server is busy with uploads |
| `503 images.storage-failed` / `503 images.not-configured` | the photo storage did not take the file, or is not set up |

Every `404` has the same body, so a caller cannot tell which part was wrong (CWE-639, CWE-203). Two photos for different places can
upload at the same time. Two photos for the same place give one `200` and one `404`; the second file is queued for removal.

### A failed photo is a missing photo (D-03)

The text is always saved first. When a photo fails for any reason, the request stays saved and that place stays empty, which staff
see as a missing photo. The visitor's next photo still works. A file that may have reached storage (a timeout, or a place that was
filled first) is queued for removal as `UploadUndone`, and the maintenance job removes it later.

## Answers of the create call

- `200` with `{ "id": "...", "photoSlots": [...] }`. The id names the new request. Nothing else about it is sent back.
- `400 quote-requests.validation` with an `errors` object: one array of messages for each field that failed, with the field names
  above. An empty or unreadable body lists the two required fields.
- `429` when one address sends too many. The limits arrive with the bot guards of a later plan.
