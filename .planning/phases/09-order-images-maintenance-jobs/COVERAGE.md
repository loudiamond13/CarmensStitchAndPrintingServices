# API Coverage: Cloudinary

*Created: 2026-10-31T11:30:00-05:00 · Updated: 2026-10-31T11:30:00-05:00*

> Full coverage by default. Opt-outs are explicit, reasoned decisions. Integration is through CloudinaryDotNet 1.29.3 (D-37) in Csps.Infrastructure only, on the owner's free-plan account (D-06); tests never call Cloudinary (D-07).

| capability | decision | reason |
|---|---|---|
| Signed server-side image upload (Upload API, ImageUploadParams) | INTEGRATE | |
| Private delivery type for stored originals (type=private) | INTEGRATE | |
| Dynamic folders (asset_folder per order under the environment root) | INTEGRATE | |
| Upload guard allowed_formats (jpg, png, webp, heic) and overwrite=false | INTEGRATE | |
| Destroy by public id with CDN invalidation (invalidate=true) | INTEGRATE | |
| Admin API list resources by prefix (max_results 500, next_cursor) | INTEGRATE | |
| Admin API usage report (storage, credits, media limits) | INTEGRATE | |
| Admin API named transformations (get, create with allowed_for_strict) | INTEGRATE | |
| Delivery URLs with named transformations and the /v1/ component | INTEGRATE | |
| Strict transformations account setting | INTEGRATE | |
| Default EXIF auto-rotation and metadata strip on delivery | INTEGRATE | |
| Signed delivery URLs | OPT-OUT | not invalidated on delete by default, which breaks D-05; named sizes of private assets need no signature |
| Authenticated delivery type | OPT-OUT | owner ruled public named sizes with random ids (D-01); authenticated allows eager variants only |
| Expiring signed URLs or token-based access | OPT-OUT | paid plans only; the design must fit the free plan (D-06) |
| Eager transformations at upload | OPT-OUT | would spend credits on every size of every photo up front; named sizes render on first view |
| f_auto inside named transformations | OPT-OUT | Cloudinary does not allow it; sizes are WebP and full size is JPEG (D-33) |
| Ad-hoc URL transformations | OPT-OUT | strict mode refuses them so free credits cannot be burned (D-03) |
| Upload presets and unsigned client uploads | OPT-OUT | uploads go through the server only and the secret never reaches the browser (IMG-01) |
| Upload widget or direct browser upload | OPT-OUT | server-only upload with byte checks and metadata stripping first (IMG-01, D-02) |
| Video, raw and audio resource types | OPT-OUT | order photos only |
| Tags, contextual and structured metadata | OPT-OUT | not needed; ids and customer data must not be copied into asset metadata |
| Bulk delete by prefix or tag (Admin API delete_resources) | OPT-OUT | bulk invalidation is not on by default; per-asset destroy is used and is not rate-limited |
| Webhooks and notification_url | OPT-OUT | uploads are synchronous and the site exposes no inbound callback |
| Rename or move assets | OPT-OUT | public ids never change after upload |
| Backups and version restore | OPT-OUT | not on the free plan and not needed; deletes are intended to be final |
| Add-ons (background removal, moderation, auto-tagging, OCR) | OPT-OUT | paid add-ons outside the free plan and not in scope |
| Search API | OPT-OUT | prefix listing covers the stray sweep |
| Responsive breakpoints generation API | OPT-OUT | the server computes srcset from the fixed named sizes |
| Image analysis (colors, faces, quality scores) | OPT-OUT | not needed and would process customer photos for no purpose |
| Archive and ZIP generation | OPT-OUT | not needed |
| Custom delivery domain (CNAME) and multi-CDN | OPT-OUT | paid features; res.cloudinary.com is already allowed by the CSP |
| Sub-accounts and provisioning API | OPT-OUT | one account with separate folders per environment (D-07) |
| Streaming profiles and the video player | OPT-OUT | video is not used |
