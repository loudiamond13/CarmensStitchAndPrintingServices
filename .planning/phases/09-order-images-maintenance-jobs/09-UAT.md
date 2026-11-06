---
status: partial
phase: 09-order-images-maintenance-jobs
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md, 09-06-SUMMARY.md, 09-07-SUMMARY.md, 09-08-SUMMARY.md, 09-09-SUMMARY.md, 09-10-SUMMARY.md, 09-11-SUMMARY.md, 09-12-SUMMARY.md, 09-13-SUMMARY.md, 09-14-SUMMARY.md, 09-15-SUMMARY.md, 09-16-SUMMARY.md, 09-17-SUMMARY.md, 09-18-SUMMARY.md, 09-19-SUMMARY.md, 09-20-SUMMARY.md, 09-21-SUMMARY.md, 09-22-SUMMARY.md, 09-23-SUMMARY.md, 09-24-SUMMARY.md, 09-25-SUMMARY.md, 09-26-SUMMARY.md, 09-27-SUMMARY.md, 09-28-SUMMARY.md, 09-29-SUMMARY.md, 09-30-SUMMARY.md]
started: 2026-11-05T17:58:00-06:00
created: 2026-11-05T17:58:00-06:00
updated: 2026-11-06T10:02:00-06:00
---

# Phase 9 UAT: Order Images & Maintenance Jobs
*Created: 2026-11-05T17:58:00-06:00 · Updated: 2026-11-06T10:02:00-06:00*

Plans 09-01 to 09-30 are built. 09-31 and 09-32 (the database backup job) are not built; test 21 is blocked on them.
Tests 22 to 96 are passed by automated tests (coverage blocks); they are not asked.

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running API and web server. Run the preflight, start the API (5115) and the web app (5180) from scratch on CSPS_Dev with the Phase 9 migrations applied (OrderImages, ImageDeletions). The API starts with no errors or warnings, /health answers, and the admin Orders list loads with real data.
result: pass

### 2. Pick photos on the New Order form
expected: On Admin, New Order, the Images card says "Mockups and reference photos. They upload after you save the order." Pick 3 photos (browse or drag onto "Drag images here or browse"). Each shows as a tile with a preview, "Photo n of 3", the description "New order photo n", and the hint counts "3/5". Photo 1 has the Cover tag. Move left or right, Make Cover, Edit description and Remove photo all work without saving anything. At 5 photos the add area is replaced by "You've picked 5 photos, the most an order can have. Remove one to pick another."
result: pass

### 3. Draft photos upload after Save Order
expected: Save the new order with its draft photos. You land on the order page with the "Order saved" toast. The Images card shows the drafts as "Waiting to upload", then "Uploading photo i of n" in the status line, and they turn into saved photos in the same order with the descriptions you typed. The first draft is the cover. When all are done a "Photos added" toast says "n photos added to ORD-...".
result: pass

### 4. Add photos on the order page
expected: On an active order page the Images card hint says "Mockups and reference photos. The cover shows on the Orders list." and "JPG, PNG, WEBP or HEIC · up to 10 MB each · n/5". Picking or dropping photos uploads them one at a time with the status line counting up, then "Photos added". At 5 photos the add area is replaced by "This order has 5 photos, the most it can have. Delete one to add another."
result: pass

### 5. Refused files
expected: Pick a file that isn't a photo (a GIF, SVG or PDF) and a photo over 10 MB. Neither becomes a tile. A red box lists each file name with its reason: "{name} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file." and "{name} is over 10 MB. Choose a smaller photo." Picking more photos than there is room for adds what fits and says "An order can have up to 5 photos. k of the photos you picked weren't added." The box clears at the next pick.
result: pass

### 6. A failed upload and the leave guard
expected: On the order page, turn the network off (browser DevTools, Offline) and add a photo. Its tile shows "Didn't upload. Couldn't upload. Check your connection, then try again." with Try Again and Remove, and a yellow banner "1 of 1 photos didn't upload." appears. Trying to leave through the app menu opens "Leave this page?" with "Stay on Page" focused. Reload or close tab shows the browser's own prompt. Turn the network back on, press Try Again: it uploads and the banner goes.
result: pass

### 7. Arrange photos on the order page
expected: On an order with 3 or more photos: Move left and Move right swap a photo with its neighbour and save at once (a small "Saved" shows by the card title, no toast). Move left on photo 1 and Move right on the last photo are greyed out but still focusable. Make Cover on photo 3 moves it to position 1 with the Cover tag and shifts the others right. After a reload the new order is kept, and the Orders list shows the new cover.
result: pass

### 8. Edit a photo description
expected: Edit description opens "Edit Description" with "ORD-... · Photo n of total", the field prefilled and selected. Save Description closes it and the tile shows the new text with "Saved". Saving an empty field puts back the default "Order ORD-... photo n", and that default number follows the photo when it moves. Over 200 characters shows "Keep the description to 200 characters or fewer." before anything is sent. Changing the text and pressing Cancel asks "Discard changes?".
result: pass

### 9. Delete a photo
expected: Delete photo opens "Delete photo n?" with "It's removed from ORD-... right away. This can't be undone." and Cancel focused first. Delete Photo removes it, the remaining photos renumber with no gap, and "Saved" shows. Deleting photo 1 makes the next photo the cover. The add area comes back once there are fewer than 5. (Server side: 09-26 says the storage removal is queued in the same save and runs in the monthly maintenance run.)
result: pass

### 10. Photo viewer
expected: Clicking a saved photo's thumbnail opens a dark full-screen viewer showing "Photo i of n", the whole photo (never cropped, tall and wide photos fit), its description, and "Open Full Size" (opens a new tab). Previous and Next (and the left and right arrow keys) step through the photos and wrap from last to first. Esc or Close viewer closes it, and focus goes back to the thumbnail of the photo last shown. On a phone-width screen Previous and Next sit under the photo.
result: pass
retest: "Fixed by 09-33. The three G-09-10 checks on the real order page passed in CI on 2026-11-06 (chromium; the phone layout check also passed on pixel). Run 42233493464, commit 936e2139."
first_result: issue
reported: "image inst centered" (screenshot: at 1899 px wide, Photo 1 of 4 on ORD-2026-0161 sits left of center between Previous and Next; the white image box is taller than the photo, leaving a large empty band under it)
severity: cosmetic

### 11. Read-only photos on Completed and deleted orders
expected: On a Completed (or Cancelled) order, the Images card has no add area, no Move, Make Cover, Edit or Delete buttons, but thumbnails still open the viewer. An order with no photos says "No photos on this order." Reopening the order brings the controls back. A soft-deleted order's view still shows its photos read-only, and Restore brings the order back with them.
result: pass

### 12. Covers on the Orders list
expected: In the Orders grid each card shows the order's cover photo; an order with more than 1 photo shows a photo-count chip, and an order with no photos shows "No images yet". In the table view each row has a small square cover thumbnail. Nothing jumps around as covers load.
result: pass

### 13. Phone layout and camera
expected: On a phone (or DevTools phone mode with touch), the Images card shows two buttons "Take Photo" and "Choose Photos" instead of the drop zone. Take Photo opens the camera, Choose Photos opens the photo picker. At 320 px wide the photo list is one column and nothing scrolls sideways. Every photo button is easy to tap.
result: pass

### 14. Look and feel in both themes
expected: The Images card, tiles (thumbnail, "Photo n of total", description, Cover tag and ring, Make Cover), the status line, banners, the description window and the viewer look tidy and readable at 390, 820 and 1440 px in both Blush and Espresso. Long descriptions and long file names wrap instead of overflowing.
result: pass

### 15. No photo kept in browser storage
expected: After picking and uploading photos, the browser keeps no photo, preview or file data in its storage: DevTools, Application, Local storage, Session storage and IndexedDB for localhost:5180 hold nothing photo-related.
result: pass

### 16. Where the Cloudinary keys live
expected: You know that the three Cloudinary values (cloud name, API key, API secret) go in user-secrets on your PC and in the host's app pool variables (Cloudinary__CloudName, Cloudinary__ApiKey, Cloudinary__ApiSecret), and never in git, chat, docs or screenshots. docs/operations/cloudinary-setup.md says this in words you can follow.
result: pass

### 17. Cloudinary named sizes and strict mode
expected: The setup tool's --check says "13 exist", and strict transformations are on in the Cloudinary account.
result: pass
source: owner checkpoint 09-30 Task 3 (2026-11-05)

### 18. A real browser photo reaches Cloudinary
expected: A PNG picked in the browser uploads to the dev Cloudinary folder and shows on the order.
result: pass
source: owner checkpoint 09-30 Task 3 (2026-11-05), after fix d3ef31d2

### 19. Real phone photos: GPS removed and shown upright
expected: A real phone photo (Android JPEG and iPhone HEIC) is stored with no GPS or camera data and shows upright.
result: skipped
reason: Owner ruling 2026-11-05 (09-30 Task 3): proven by automated tests only; one real photo on each platform is item 5 of the release-day list.

### 20. Maintenance run from GitHub (Run now)
expected: After deploy, with the MAINTENANCE_KEY secret and SITE_ORIGIN set, pressing Run now on the Maintenance workflow turns green and its summary shows "## Maintenance run" with counts only: photos removed, purge lines, stray files, Cloudinary usage, and "All maintenance jobs finished."
result: blocked
blocked_by: release-build
reason: Needs the production deploy, the host's Maintenance__Key and the GitHub secret; it is item 6 of the release-day list.

### 21. Monthly database backup job (09-31, 09-32)
expected: The monthly run makes a database backup the owner can restore.
result: blocked
blocked_by: other
reason: Not built. Deferred by owner ruling D-51 (2026-11-05): backups stay manual in the control panel until CUT-01 (Phase 17) picks an approach.

### 22. 09-01 D1: A JPEG posted to an order is stored through the port and saved as a photo row at Slot 0...
expected: A JPEG posted to an order is stored through the port and saved as a photo row at Slot 0 and Position 0 with its size, bytes and format, audited as order-image.added
result: pass
source: automated
coverage_id: 09-01-D1

### 23. 09-01 D2: A file that is not a JPEG by its first bytes is refused with the type message and never...
expected: A file that is not a JPEG by its first bytes is refused with the type message and never reaches storage
result: pass
source: automated
coverage_id: 09-01-D2

### 24. 09-01 D3: An order holds at most 5 photos, takes none while Completed or Cancelled, and keeps a c...
expected: An order holds at most 5 photos, takes none while Completed or Cancelled, and keeps a clean description
result: pass
source: automated
coverage_id: 09-01-D3

### 25. 09-01 D4: Public ids carry 128 random bits and never the file name
expected: Public ids carry 128 random bits and never the file name
result: pass
source: automated
coverage_id: 09-01-D4

### 26. 09-01 D5: A host with no image storage starts, /health stays 200, and the upload answers 503 'Pho...
expected: A host with no image storage starts, /health stays 200, and the upload answers 503 'Photo uploads aren't set up yet.'
result: pass
source: automated
coverage_id: 09-01-D5

### 27. 09-01 D6: The upload is in the authorization matrix (anonymous 401, Admin 400, Manager 400), the ...
expected: The upload is in the authorization matrix (anonymous 401, Admin 400, Manager 400), the OpenAPI snapshot and the generated web types
result: pass
source: automated
coverage_id: 09-01-D6

### 28. 09-02 D1: A stored photo gets a private, named-size, /v1/ address for its tile thumb with a 1x an...
expected: A stored photo gets a private, named-size, /v1/ address for its tile thumb with a 1x and a 2x candidate
result: pass
source: automated
coverage_id: 09-02-D1

### 29. 09-02 D2: Viewer and card candidates carry true widths, are ascending and unique, and are never w...
expected: Viewer and card candidates carry true widths, are ascending and unique, and are never wider than the photo; a smaller photo gets one candidate per slot
result: pass
source: automated
coverage_id: 09-02-D2

### 30. 09-02 D3: The catalog has exactly the 13 agreed names, none with f_auto, display sizes in WebP an...
expected: The catalog has exactly the 13 agreed names, none with f_auto, display sizes in WebP and the full size in JPEG
result: pass
source: automated
coverage_id: 09-02-D3

### 31. 09-02 D4: Production accepts only the csps folder and every other environment refuses it; folder ...
expected: Production accepts only the csps folder and every other environment refuses it; folder and cloud name are lowercase letters, digits and hyphens; OrdersPrefix ends in a slash
result: pass
source: automated
coverage_id: 09-02-D4

### 32. 09-03 D1: A 4000 x 3000 phone JPEG comes out 2000 x 1500 at quality 0.85, upright, with a data: p...
expected: A 4000 x 3000 phone JPEG comes out 2000 x 1500 at quality 0.85, upright, with a data: preview; a 1800 x 1200 JPEG is returned as the same File
result: pass
source: automated
coverage_id: 09-03-D1

### 33. 09-03 D2: Files are checked by their bytes: JPEG, PNG, WebP and HEIC are accepted; SVG, GIF, AVIF...
expected: Files are checked by their bytes: JPEG, PNG, WebP and HEIC are accepted; SVG, GIF, AVIF, BMP and anything else are refused whatever the name or MIME type
result: pass
source: automated
coverage_id: 09-03-D2

### 34. 09-03 D3: Output types: JPEG and HEIC become JPEG, PNG stays PNG, WebP stays WebP only when the b...
expected: Output types: JPEG and HEIC become JPEG, PNG stays PNG, WebP stays WebP only when the browser made WebP; the produced blob type is checked
result: pass
source: automated
coverage_id: 09-03-D3

### 35. 09-03 D4: Size, pixel and unreadable refusals mirror the server; a HEIC the browser cannot decode...
expected: Size, pixel and unreadable refusals mirror the server; a HEIC the browser cannot decode goes unchanged with no preview when within the size
result: pass
source: automated
coverage_id: 09-03-D4

### 36. 09-04 D1: LazyImage passes srcSet and sizes to the img and fits with contain (whole photo, uncrop...
expected: LazyImage passes srcSet and sizes to the img and fits with contain (whole photo, uncropped) when asked; cover stays the default and the skeleton and error placeholder are unchanged
result: pass
source: automated
coverage_id: 09-04-D1

### 37. 09-04 D2: The viewer is a modal dialog named by its label with focus on Close viewer, the counter...
expected: The viewer is a modal dialog named by its label with focus on Close viewer, the counter 'Photo {i} of {n}', Previous and Next (wrapping, hidden with one photo), Esc, ArrowLeft and ArrowRight, and onClose gets the id of the photo shown last
result: pass
source: automated
coverage_id: 09-04-D2

### 38. 09-04 D3: A polite region announces 'Photo {i} of {n}: {description}' on each change; the caption...
expected: A polite region announces 'Photo {i} of {n}: {description}' on each change; the caption shows the description aria-hidden
result: pass
source: automated
coverage_id: 09-04-D3

### 39. 09-04 D4: Open Full Size is a new-tab link with rel noopener noreferrer and a hidden notice, and ...
expected: Open Full Size is a new-tab link with rel noopener noreferrer and a hidden notice, and is not rendered without a full-size address
result: pass
source: automated
coverage_id: 09-04-D4

### 40. 09-04 D5: A failed viewer photo shows the placeholder named by its alt inside the box and the con...
expected: A failed viewer photo shows the placeholder named by its alt inside the box and the controls still work; a changed photo list keeps the same photo by id, else the nearest position, and closes when empty
result: pass
source: automated
coverage_id: 09-04-D5

### 41. 09-04 D7: The camera icon is registered from the installed lucide-react
expected: The camera icon is registered from the installed lucide-react
result: pass
source: automated
coverage_id: 09-04-D7

### 42. 09-08 D3: Move left on the first photo and Move right on the last (and both on a single photo) ar...
expected: Move left on the first photo and Move right on the last (and both on a single photo) are aria-disabled, stay focusable and do nothing; busy makes every saved-photo control aria-disabled with focus kept and drag off, while picking files still works
result: pass
source: automated
coverage_id: 09-08-D3

### 43. 09-08 D4: Waiting, uploading, failed (retryable or not), draft, preview-pending and preview-unava...
expected: Waiting, uploading, failed (retryable or not), draft, preview-pending and preview-unavailable tiles; readonly mode with 'No photos on this order.'; the limit note in place of the add area at 5 counting pending files; the pick-error alert with one line per file and the left-out count
result: pass
source: automated
coverage_id: 09-08-D4

### 44. 09-08 D5: Dragging a tile onto another calls onMove with the 0-based position; waiting files are ...
expected: Dragging a tile onto another calls onMove with the 0-based position; waiting files are not part of the drag; a tile drag never marks the drop zone
result: pass
source: automated
coverage_id: 09-08-D5

### 45. 09-08 D6: The five showcase cases (empty, three photos, read-only, draft with a waiting and a fai...
expected: The five showcase cases (empty, three photos, read-only, draft with a waiting and a failed file, limit) are parity false and axe-clean; the browser check shows that only the grip is hidden at rest on hover devices and every control is at full opacity on every device; a draft photo previews from a data: address under the strict CSP
result: pass
source: automated
coverage_id: 09-08-D6

### 46. 09-09 D1: Signed-in staff read the server's photo rules (5 photos, 10485760 bytes, 25000000 pixel...
expected: Signed-in staff read the server's photo rules (5 photos, 10485760 bytes, 25000000 pixels, 10000 side, jpeg/png/webp/heic, 200 characters); anonymous gets 401
result: pass
source: automated
coverage_id: 09-09-D1

### 47. 09-09 D2: The Testing store serves an uploaded photo with its stored content type, answers 404 fo...
expected: The Testing store serves an uploaded photo with its stored content type, answers 404 for an unknown id, and fail-next makes the next upload 503 and the one after succeed
result: pass
source: automated
coverage_id: 09-09-D2

### 48. 09-09 D3: A Release build holds no Testing image route or type
expected: A Release build holds no Testing image route or type
result: pass
source: automated
coverage_id: 09-09-D3

### 49. 09-09 D4: The upload declares 422 and its summary names orders.locked; the OpenAPI snapshot and g...
expected: The upload declares 422 and its summary names orders.locked; the OpenAPI snapshot and generated types carry ImageRulesResponse
result: pass
source: automated
coverage_id: 09-09-D4

### 50. 09-09 D5: The upload contract, the rules endpoint, the images field and the two Testing routes ar...
expected: The upload contract, the rules endpoint, the images field and the two Testing routes are written down
result: pass
source: automated
coverage_id: 09-09-D5

### 51. 09-16 D1: On an active order the Images card replaces the coming-soon card; a picked photo become...
expected: On an active order the Images card replaces the coming-soon card; a picked photo becomes a waiting tile, uploads under its own Idempotency-Key and turns into a saved photo whose thumb the server delivers
result: pass
source: automated
coverage_id: 09-16-D1

### 52. 09-16 D2: Several photos upload one at a time in pick order with 'Uploading photo i of n', spoken...
expected: Several photos upload one at a time in pick order with 'Uploading photo i of n', spoken updates and the 'Photos added' toast; more picks during a batch join the same queue
result: pass
source: automated
coverage_id: 09-16-D2

### 53. 09-16 D3: Every server rule is checked in the browser first with the server's wording: type, size...
expected: Every server rule is checked in the browser first with the server's wording: type, size, pixels, readability and the 5 photo limit counting saved, waiting, uploading and failed files; an svg renamed .jpg sends no request
result: pass
source: automated
coverage_id: 09-16-D3

### 54. 09-16 D4: A failed upload stays as a tile with its reason; Try Again (retryable failures only) re...
expected: A failed upload stays as a tile with its reason; Try Again (retryable failures only) resends the same key and the same bytes, once; the banner leaves when no failed tile remains; a locked order fails waiting files with the server text and turns the card read-only
result: pass
source: automated
coverage_id: 09-16-D4

### 55. 09-19 D1: CloudinaryDotNet 1.29.3 pinned exactly, referenced by Csps.Infrastructure only, recorde...
expected: CloudinaryDotNet 1.29.3 pinned exactly, referenced by Csps.Infrastructure only, recorded with approval, notices and lock files; the dependency registry and license gate pass
result: pass
source: automated
coverage_id: 09-19-D1

### 56. 09-19 D2: An upload goes to Cloudinary as a private, signed, non-overwriting asset with the serve...
expected: An upload goes to Cloudinary as a private, signed, non-overwriting asset with the server-made public id and asset folder, no folder field and no empty field
result: pass
source: automated
coverage_id: 09-19-D2

### 57. 09-19 D3: Removal invalidates cached copies and maps ok, not found, busy and refused keys; listin...
expected: Removal invalidates cached copies and maps ok, not found, busy and refused keys; listing and the usage report work and failures throw a short code
result: pass
source: automated
coverage_id: 09-19-D3

### 58. 09-19 D4: Outside Testing the Cloudinary storage is used only when all three keys are set; otherw...
expected: Outside Testing the Cloudinary storage is used only when all three keys are set; otherwise the 503 storage and the site still starts
result: pass
source: automated
coverage_id: 09-19-D4

### 59. 09-19 D5: No answer, header or log line holds the API secret or key; ApiSecret is masked; only In...
expected: No answer, header or log line holds the API secret or key; ApiSecret is masked; only Infrastructure references the Cloudinary library
result: pass
source: automated
coverage_id: 09-19-D5

### 60. 09-20 D1: Moving a photo to a place shifts the others and keeps places 0 to n-1; Make Cover is a ...
expected: Moving a photo to a place shifts the others and keeps places 0 to n-1; Make Cover is a move to 0; the answer is the whole order with a new version
result: pass
source: automated
coverage_id: 09-20-D1

### 61. 09-20 D2: A stale version answers 409 and changes nothing; two moves with one version give one 20...
expected: A stale version answers 409 and changes nothing; two moves with one version give one 200 and one 409
result: pass
source: automated
coverage_id: 09-20-D2

### 62. 09-20 D3: Description is trimmed; empty or the default of the current place is stored as none; ov...
expected: Description is trimmed; empty or the default of the current place is stored as none; over 200 characters is a 400 with the plain message
result: pass
source: automated
coverage_id: 09-20-D3

### 63. 09-20 D4: Closed orders answer 422 orders.locked; a photo not on the order answers 404 with the p...
expected: Closed orders answer 422 orders.locked; a photo not on the order answers 404 with the plain message
result: pass
source: automated
coverage_id: 09-20-D4

### 64. 09-20 D5: Moves, cover changes and description changes are audited with no photo id or address; a...
expected: Moves, cover changes and description changes are audited with no photo id or address; a no-op writes nothing; both roles get 200 and anonymous 401
result: pass
source: automated
coverage_id: 09-20-D5

### 65. 09-20 D6: The contract (docs, OpenAPI snapshot, generated types) lists both routes and every status
expected: The contract (docs, OpenAPI snapshot, generated types) lists both routes and every status
result: pass
source: automated
coverage_id: 09-20-D6

### 66. 09-21 D1: On the New Order form, staff pick photos into the Images card; each runs prepareImage a...
expected: On the New Order form, staff pick photos into the Images card; each runs prepareImage and the pick checks and becomes a draft tile named New order photo {n}; with no drafts the add area shows 0/5 and the form saves without photos
result: pass
source: automated
coverage_id: 09-21-D1

### 67. 09-21 D2: Save creates the order exactly as before, then hands the drafts to that order's upload ...
expected: Save creates the order exactly as before, then hands the drafts to that order's upload queue in draft order with their descriptions; the first draft becomes the cover; a failed create keeps the drafts; no drafts means no upload
result: pass
source: automated
coverage_id: 09-21-D2

### 68. 09-21 D3: Drafts can be moved, made cover and removed on the form with no request; the limit of 5...
expected: Drafts can be moved, made cover and removed on the form with no request; the limit of 5 keeps the first files and counts the ones left out, then the F1 note replaces the add area; a Skeleton shows until the data: preview is ready; drafts make the form dirty so Discard changes covers them
result: pass
source: automated
coverage_id: 09-21-D3

### 69. 09-21 D4: The Edit Description window for a draft: titled with New order, Photo n of total; field...
expected: The Edit Description window for a draft: titled with New order, Photo n of total; field prefilled and selected; empty or default text kept as default; more than the server limit after trim refused in the browser; Saving state; Discard changes on a changed field; no request; the description travels with the draft to the upload
result: pass
source: automated
coverage_id: 09-21-D4

### 70. 09-23 D1: Tapping a saved photo's thumb on the order page opens the viewer at that photo with the...
expected: Tapping a saved photo's thumb on the order page opens the viewer at that photo with the viewer srcSet and sizes; arrows wrap, Esc and Close viewer return focus to the thumb of the photo shown last; Open Full Size is a link to the full-size address in a new tab (noopener)
result: pass
source: automated
coverage_id: 09-23-D1

### 71. 09-23 D2: If the photos reload while the viewer is open it keeps the same photo, else the nearest...
expected: If the photos reload while the viewer is open it keeps the same photo, else the nearest; with none left it closes and focus goes to the card heading; a waiting file has no open button
result: pass
source: automated
coverage_id: 09-23-D2

### 72. 09-23 D3: A Completed or Cancelled order's Images card is read-only (no add area, no limit note, ...
expected: A Completed or Cancelled order's Images card is read-only (no add area, no limit note, no second row, no drag, no Make Cover) while thumbs still open the viewer; a reopen brings the controls back; read-only with no photos says 'No photos on this order.'
result: pass
source: automated
coverage_id: 09-23-D3

### 73. 09-23 D4: The Manager's deleted-order view shows the soft-deleted order's photos read-only with t...
expected: The Manager's deleted-order view shows the soft-deleted order's photos read-only with the viewer; the coming-soon card is gone
result: pass
source: automated
coverage_id: 09-23-D4

### 74. 09-24 D1: A Manager's permanent delete adds one OrderDeleted row per photo in the same save; noth...
expected: A Manager's permanent delete adds one OrderDeleted row per photo in the same save; nothing is sent to the storage
result: pass
source: automated
coverage_id: 09-24-D1

### 75. 09-24 D2: A soft delete and a restore add no row and keep every photo (D-20)
expected: A soft delete and a restore add no row and keep every photo (D-20)
result: pass
source: automated
coverage_id: 09-24-D2

### 76. 09-24 D3: A rolled-back change keeps no queue row; EnqueueNowAsync keeps its row even when the re...
expected: A rolled-back change keeps no queue row; EnqueueNowAsync keeps its row even when the request never saves or rolls back
result: pass
source: automated
coverage_id: 09-24-D3

### 77. 09-24 D4: An upload whose photo row cannot be saved after the file reached storage leaves one Upl...
expected: An upload whose photo row cannot be saved after the file reached storage leaves one UploadUndone row naming the uploaded id and no photo row
result: pass
source: automated
coverage_id: 09-24-D4

### 78. 09-24 D5: The ImageDeletions table has the planned columns, identity key and both indexes (Public...
expected: The ImageDeletions table has the planned columns, identity key and both indexes (PublicId not unique), with no JSON column and no trigger
result: pass
source: automated
coverage_id: 09-24-D5

### 79. 09-27 D1: Move photo n left or right saves at once with the latest order version; the tiles reord...
expected: Move photo n left or right saves at once with the latest order version; the tiles reorder when the server answers; focus stays on the pressed control (or the photo's other move button at an end); 'Saved' shows and the polite region says 'Moved to position n of total.'
result: pass
source: automated
coverage_id: 09-27-D1

### 80. 09-27 D2: Make Cover saves as a move to position 0, announces 'It's now the cover.', focuses that...
expected: Make Cover saves as a move to position 0, announces 'It's now the cover.', focuses that photo's Edit description, and shows as the cover on the Orders list; drag onto another tile sends the same request
result: pass
source: automated
coverage_id: 09-27-D2

### 81. 09-27 D3: While a change saves or a file waits or uploads, every saved-photo control is aria-disa...
expected: While a change saves or a file waits or uploads, every saved-photo control is aria-disabled with focus kept and drag is off; Saved clears after 4 seconds or at the next change; the ends of the list and a single photo behave
result: pass
source: automated
coverage_id: 09-27-D3

### 82. 09-27 D4: A 409 reloads the photos, toasts 'Photos reloaded' and focuses the Images heading with ...
expected: A 409 reloads the photos, toasts 'Photos reloaded' and focuses the Images heading with no retry; a 422 orders.locked refetches, makes the card read-only and toasts the server text; other failures toast the plain-English line
result: pass
source: automated
coverage_id: 09-27-D4

### 83. 09-27 D5: Edit description saves a saved photo at once with the version the window opened with; e...
expected: Edit description saves a saved photo at once with the version the window opened with; empty or default text clears it; 409 shows the ConflictBanner and Load Latest puts the latest text in the field; 404 and 422 block Save with their banners; the limit counts UTF-16 units; focus returns to Edit description and Saved shows
result: pass
source: automated
coverage_id: 09-27-D5

### 84. 09-27 D6: The Audit Log words the five order-image codes as Order photo added, Order photo moved,...
expected: The Audit Log words the five order-image codes as Order photo added, Order photo moved, Order cover photo changed, Order photo description changed, Order photo deleted
result: pass
source: automated
coverage_id: 09-27-D6

### 85. 09-28 D1: A deleted photo's file leaves the storage on the next run, cache invalidation included,...
expected: A deleted photo's file leaves the storage on the next run, cache invalidation included, and its queue row is deleted
result: pass
source: automated
coverage_id: 09-28-D1

### 86. 09-28 D2: Two runs claiming the same row: exactly one owns it; an expired lease can be claimed ag...
expected: Two runs claiming the same row: exactly one owns it; an expired lease can be claimed again; a row not yet due is left alone
result: pass
source: automated
coverage_id: 09-28-D2

### 87. 09-28 D3: A transient answer is retried with waits of 2 and 8 seconds; a row that still fails kee...
expected: A transient answer is retried with waits of 2 and 8 seconds; a row that still fails keeps its place with Attempts + 1 and its code and turns the run red; the next run removes it
result: pass
source: automated
coverage_id: 09-28-D3

### 88. 09-28 D4: Refused keys stop the job at once with the keys line and leave every row for the next r...
expected: Refused keys stop the job at once with the keys line and leave every row for the next run; no log line holds a public id
result: pass
source: automated
coverage_id: 09-28-D4

### 89. 09-28 D5: The stray sweep queues only unknown files older than 2 days in its own folder, with the...
expected: The stray sweep queues only unknown files older than 2 days in its own folder, with the 2 day boundary exact, and reports the count
result: pass
source: automated
coverage_id: 09-28-D5

### 90. 09-28 D6: A photo of a soft-deleted order (and of a live order) is never swept or removed, and a ...
expected: A photo of a soft-deleted order (and of a live order) is never swept or removed, and a queue row that names a live photo is dropped while the file stays
result: pass
source: automated
coverage_id: 09-28-D6

### 91. 09-28 D7: Each job stops when the run budget is spent and reports More; rows taken but not reache...
expected: Each job stops when the run budget is spent and reports More; rows taken but not reached are released; a listing that cannot be read gives a failed line, never an unhandled error
result: pass
source: automated
coverage_id: 09-28-D7

### 92. 09-29 D1: Delete photo n opens 'Delete photo n?' with the order number message, Cancel focused fi...
expected: Delete photo n opens 'Delete photo n?' with the order number message, Cancel focused first and the danger 'Delete Photo' (pending 'Deleting'); confirming sends one DELETE; a double press sends one
result: pass
source: automated
coverage_id: 09-29-D1

### 93. 09-29 D2: After a delete the photos come from the answer, Saved shows, the polite line reads 'Pho...
expected: After a delete the photos come from the answer, Saved shows, the polite line reads 'Photo deleted. n photos left.' ('1 photo left.' / 'No photos left.'), and focus goes to the next thumb, else the previous, else the first add control, else the heading; Cancel returns focus to that photo's Delete control
result: pass
source: automated
coverage_id: 09-29-D2

### 94. 09-29 D3: A 404 closes the dialog, reloads the photos and announces 'That photo was already delet...
expected: A 404 closes the dialog, reloads the photos and announces 'That photo was already deleted.'; a 422 shows the server sentence in the dialog and turns the card read-only; any other failure keeps the dialog open with a role=alert line and no Saved
result: pass
source: automated
coverage_id: 09-29-D3

### 95. 09-29 D4: The Manager's permanent-delete dialog counts the order's real photos in the Images tile...
expected: The Manager's permanent-delete dialog counts the order's real photos in the Images tile and the sentence; the soft-delete sentence still leaves photos out
result: pass
source: automated
coverage_id: 09-29-D4

### 96. 09-29 D5: No Delete control on a Completed or Cancelled order or on the deleted view (read-only c...
expected: No Delete control on a Completed or Cancelled order or on the deleted view (read-only card); a long order number in the dialog message is shown and the dialog has no axe violations
result: pass
source: automated
coverage_id: 09-29-D5

## Summary

total: 96
passed: 93
issues: 0
pending: 0
skipped: 1
blocked: 2

## Gaps

- gap_id: G-09-10
  truth: "The viewer shows the whole photo centered in the stage between Previous and Next, with the image box fitted to the photo"
  status: resolved
  verified: "CI run 42233493464 on 936e2139 (2026-11-06): order-photos-view.spec.ts G-09-10 checks passed on the real order page"
  reason: "User reported: image inst centered (screenshot: photo left of center, white box taller than the photo)"
  severity: cosmetic
  test: 10
  root_cause: "The viewer image box (viewerImageClasses, grid column 2 of the 56 / 1fr / 56 stage) has an aspect ratio from the stored photo size and a max height of min(680px, 100dvh - 200px). On a wide window the height cap makes the box narrower than the 1fr column, and with no justify-self it sits at the start of the column, so the photo is left of center. The white band under the mockup is most likely the photo itself (the box ratio equals the stored ratio and the photo is fitted with object-fit: contain; this mockup has a white background); confirm with Open Full Size while fixing."
  artifacts:
    - path: "web/src/components/media/photoViewer.recipe.ts"
      issue: "viewerImageClasses has no justify-self-center (and no w-auto or max-w-full), so a height-capped box hugs the left of its grid cell"
    - path: "web/src/components/media/PhotoViewer.tsx"
      issue: "LazyImage gets the ratio box; no change expected beyond the recipe"
  missing:
    - "Center the image box in the stage column (justify-self-center, width driven by the ratio and max height, never wider than the column), keeping the phone layout (col-span-full) unchanged"
    - "A failing test first: a wide window (1899 x 951) with a landscape photo whose capped box is narrower than the column shows the box centered (equal space left and right of it between Previous and Next), plus a unit test that the recipe carries the centering class"
  debug_session: ""
  fix_plan: "09-33-PLAN.md"
  resolved_by: 09-33-PLAN.md
  resolved_at: 2026-11-05
