# Manual accessibility passes: keyboard, NVDA and VoiceOver

*Created: 2026-11-27T21:18:50-06:00 · Updated: 2026-11-28T02:15:02-06:00*

This page is the script and the results record for the hand-run accessibility passes (A11Y-05, 14 D-08 to D-10). The automated checks (axe, Lighthouse, the keyboard tests) catch a lot. They cannot say what a screen reader actually speaks, so a person has to listen.

There are eight critical flows. For each one, this page lists the steps, the keys or gestures, and what the screen reader should say. The words come from the screens' own labels, headings and messages in the code.

Nothing on this page is a result until someone has run it. Every result starts as "Not run".

## How to run the passes

Who does what:

- **Claude** wrote these scripts and runs the keyboard-only pass itself. Those results go in the Keyboard column (plan 14-26).
- **The owner** runs NVDA on the Windows PC and VoiceOver on the iPhone, and fills in the NVDA and VoiceOver columns (plan 14-28).

Where each pass runs (14 D-10):

- **NVDA:** every flow, on the owner's PC, against the `CSPS_Dev` database. Run the preflight first, then start the API and the web app. The steps for starting them are in [the developer guide](../development.md).

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
  ```

  If the preflight says another project is using a port, wait. Never stop another project's programs.
- **VoiceOver:** every flow, on the iPhone, against the live site.
- **Sign-in codes** arrive by real email, on both the dev copy and the live site. Keep your mailbox open.

Test data on the live site:

- Staff flows on the live site use the owner's own account.
- The test order and the test expense are named `TEST` and are deleted afterwards. The steps for that are in flows 4 and 5.
- The test quote request is marked Spam (flow 8). Its photos then go within a day, and its text goes at the 6-month purge.
- Audit log entries from the test stay, because the audit log is append-only. That is expected.
- Use made-up names and a harmless test picture. Never use a real customer's details or photos.
- Never write a real email address, phone number or password on this page.

How to mark a step:

1. Run the step on the screen reader. Compare what it says with the table.
2. Write **Pass** or **Fail** in that screen reader's column of the Results table, and the date you ran it as `yyyy-MM-dd` in the Date column.
3. For every **Fail**, write in Outcome what happened and what should be done. A failed step is never left without an outcome. A WCAG 2.2 AA failure is fixed before release (14 D-08).
4. If you could not run a step, leave it as **Not run** and write the reason in Outcome. A signed record cannot hold a Not run without a reason.

Be careful with the sign-in code (flow 1). Ten wrong codes in an hour, counted across every sign-in try, pause sign-in for 15 minutes. One code also stops working after five wrong tries ("This code can't be used anymore"), with no pause. Use one wrong code, once.

## How to read a script

- Each step has an id such as 1.4 (flow 1, step 4). The Results table uses the same ids.
- The **Do** column gives the keys for the PC (NVDA) and the gestures for the phone (VoiceOver). "Phone:" marks the phone version. If only one is given, it is the same on both.
- The two **should say** columns give what the reader should speak: the name, the kind of control and its state. The words in quotes come from the screen.
- Readers word things a little differently, and a verbosity setting changes the order. Do not fail a step for small wording or order differences, or for extras such as "clickable".
- Fail a step when a name is missing or wrong, the kind of control is wrong, a state is not spoken (required, invalid, pressed, unavailable), focus goes somewhere unexpected or is lost, something important is read twice, or something that should be read is silent.
- Steps 1.15 to 1.17 follow the Phase 14 UI design contract for the update banner and the offline screen. Those screens are built by later plans (14-23 and 14-24). Check the steps against the built screens before the passes are run.

## Tools

- **NVDA** is a free screen reader for Windows. It is a separate program, installed by hand from the NV Access website. The owner runs it by hand on the PC. It is a tool, not a project dependency, and nothing from it goes into the project (14 D-43).
- **VoiceOver** is built into the iPhone. Turn it on in Settings, Accessibility.
- Results depend on the exact versions, so write each version here when you run the passes.

- Keyboard pass browser and version: (write at run time)
- NVDA version: (write at run time)
- Windows browser and version: (write at run time)
- iPhone model and iOS version: (write at run time)

## Flow 1: Sign in with the emailed code

Dev: the web app at port 5180, page `/admin/login`. Live: the site's `/admin/login`. Use your own staff account.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 1.1 | Open the sign-in page. Press Tab once. Phone: swipe right from the top. | The tab title is "Sign in · CSPS Admin". The first stop is "Skip to main content, link". | "Skip to main content, link". |
| 1.2 | Press Enter on the skip link. Phone: double-tap. | Focus moves into the main area. The next Tab goes to the Email field, not back to the picture panel. | Focus moves into the main area. The next swipe right reaches the Sign in heading or the Email field, not the picture panel. |
| 1.3 | Find the heading. NVDA: press H. Phone: set the rotor to Headings and swipe down. | "Sign in, heading level 1". The line under it reads "Use the email and password your manager set up for you." | "Sign in, heading level 1". |
| 1.4 | Tab to the Email field. Phone: swipe right. Do not type yet. | "Email, edit, required". The form is named "Sign in". | "Email, required, text field". |
| 1.5 | Tab to the Password field, then Tab to the eye button. Press Space on it. Press Space again. Phone: swipe right twice, double-tap, double-tap. | "Password, protected edit, required". Then "Show password, toggle button, not pressed". After Space the name is "Hide password" and the state is pressed. After the second Space it is "Show password, not pressed" again. | "Password, required, secure text field". Then "Show password, toggle button, off". After a double-tap the name is "Hide password" and the state is on. After the second double-tap it is "Show password, off" again. |
| 1.6 | Keep pressing Tab: the checkbox, the forgot link, the Sign In button, the last link. Phone: swipe right. | "Keep me signed in, check box, not checked". "Forgot password?, link". "Sign In, button". "Back to the CSPS website, link". The line "Staff only. Customer orders are placed through the public site or Messenger." is read in browse mode but has no Tab stop. | The same four names in the same order. The Staff only line is read as text between the button and the last link. |
| 1.7 | Leave both fields empty. Press the Sign In button (Enter or Space). Phone: double-tap it. | Focus jumps to the Email field. "Email, edit, invalid entry, required, Enter your email." | Focus jumps to the Email field. "Email, required, text field". The error "Enter your email." is read with the field. |
| 1.8 | Type your own email and a wrong password. Press Sign In. Do this only once. | An alert is read at once: "Email or password is incorrect. Check for typos, or ask your manager to reset your password." Focus moves to Password: "Password, protected edit". | The same alert is read at once. Focus moves to the Password field. |
| 1.9 | Type the right password. Press Sign In. | The button name is "Signing in" while it works. The next page has the tab title "Check your email · CSPS Admin". Focus is in the first code box: "Sign-in code, group", then "Digit 1 of 6, edit, required", then "Didn't get it? Check your spam folder, or use Resend Code." | The same: "Sign-in code", "Digit 1 of 6, required, text field", then the hint. |
| 1.10 | Wait a second and listen. Do not press anything. | One polite status is read: "We sent a new code. You can ask for another in" and the wait in seconds. | The same status is read once. |
| 1.11 | Open your email and read the code. In the boxes, type six digits that are not the code. Tab to Verify Code and press Enter. Use one wrong code only. | Each digit moves to the next box: "Digit 2 of 6, edit". After Verify Code the boxes are empty and focus is in the first box: "Digit 1 of 6, edit, invalid entry, required, That code isn't right. Check the newest email and try again." | The same message is read with the first box. |
| 1.12 | Tab to the Resend Code button while the wait is still running. Press Enter. Phone: swipe to it and double-tap. | "Resend code in" and the time left as m:ss, "button, unavailable". The button does nothing and says nothing. The label does not read out each second as it counts down. | "Resend code in" and the time left, "button, dimmed". It does nothing and the countdown is not read each second. |
| 1.13 | Wait for the countdown to end. Press Resend Code once. | When the wait ends, one polite status is read: "You can ask for a new code now." The button name is "Resend Code". After the press: "We sent a new code. You can ask for another in" and the wait. Use the newest code from here. | The same two statuses are read once each. |
| 1.14 | Type the newest code. Tab to Verify Code and press Enter. | The button reads "Verifying". The admin opens. If your account must set a new password first, the "Set a new password" screen opens instead. The tab title starts with the page name. The first Tab stop on the new page is "Skip to main content, link". | The same. |
| 1.15 | Update banner. Dev: open `/admin/components` and find the UpdateBanner demo. Live: only if a banner is up after a deploy. If none is up, leave VoiceOver as Not run and write "no banner on screen" in Outcome. Do not touch the keyboard while it appears. Then Tab from the top bar to the banner. | When it appears, with focus where it was: "A new version is available. Save your work first, then reload." and "Reload, button". Focus does not move. It is read once, not twice. Tab order: skip link, side menu, top bar, "Reload, button", then the page. The banner is a region named "A new version is available." | The same text is read once. Focus does not move. Swiping reaches a region named "A new version is available.", then the save line, then "Reload, button". |
| 1.16 | Offline screen. Dev: open `/admin/components` and find the OfflineCard demo. Live (iPhone, installed app): turn on Airplane mode, then open the app. | Focus is on the heading: "You're offline, heading level 1". Then "Orders and payments need a connection. Try again when you have signal." and "Try Again, button". The tab title is "You're offline · CSPS Admin". No update banner shows here. | The same heading, line and button are read in that order. |
| 1.17 | Press Try Again while there is still no signal. | The button reads "Checking" and then "Try Again" again, and focus stays on it. A polite status is read: "Still no signal. Check your mobile data or Wi-Fi, then try again." | The same status is read, and focus stays on the button. |

## Flow 2: Forgot password

Dev or live, with your own staff account. Step 2.9 really changes your password, so choose one you will keep.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 2.1 | On the sign-in page, Tab to the forgot link and press Enter. Phone: swipe to it and double-tap. Then find the heading (NVDA: H. Phone: rotor Headings). | "Forgot password?, link". The next page has the tab title "Reset your password · CSPS Admin". The first Tab stop is "Skip to main content, link". The heading is "Reset your password, heading level 1", then "Enter the email you sign in with. We'll send you a link to set a new password." | The same link, title, heading and line. |
| 2.2 | Tab through the form. Phone: swipe right. | The form is named "Reset your password". Then "Email, edit, required", "Send Reset Link, button", "Back to sign in, link". | "Email, required, text field", "Send Reset Link, button", "Back to sign in, link". |
| 2.3 | Leave Email empty. Press Send Reset Link. | Focus moves to Email: "Email, edit, invalid entry, required, Enter your email." | Focus moves to Email. The error "Enter your email." is read with the field. |
| 2.4 | Type your own email. Press Send Reset Link. | The button reads "Sending". A new card opens and focus is on its heading: "Check your email, heading level 1". Then "If an account exists for", your email, and ", we sent a link to reset your password. It works for 30 minutes." Then "Didn't get it? Check your spam folder. The email can take a few minutes." | The same heading and text are read in the same order. |
| 2.5 | Tab to "Use a Different Email" and press Enter. Phone: double-tap. | "Use a Different Email, button". Then "Back to sign in, link" follows it. After the press the form is back and focus is in the Email field: "Email, edit, required". | The same. |
| 2.6 | Open the email you were sent. Follow its link. Wait for the page. | The heading is already "Set a new password". A polite status is read: "Checking your link…" and then "Link checked." Then the form: "Choose a new password for", your email, and ". You'll sign in again after this." The tab title is "Set a new password · CSPS Admin". | The same statuses and lines are read. |
| 2.7 | Tab through the form. Type a short password in the first box and listen. | "New password, protected edit, required", then the hint "Use 8 to 64 characters with at least one number and one symbol. Don't use your name or email." As you type, the strength word (Weak, Fair, Good or Strong) is read politely. "Show password, toggle button, not pressed". "Confirm new password, protected edit, required". "Save Password, button". "Back to sign in, link". No unnamed extra field is read. | The same names and hint, with "secure text field". The strength word is read as you type. |
| 2.8 | Type a good password in the first box and a different one in Confirm. Press Save Password. | Focus is on Confirm: "Confirm new password, protected edit, invalid entry, required, Passwords don't match." | The error "Passwords don't match." is read with the Confirm field. |
| 2.9 | Make both boxes match. Press Save Password. | The button reads "Saving". The sign-in page opens and a polite notice is read: "Your password was changed. Sign in with your new password." | The same notice is read. |
| 2.10 | Open the same email link again. | Focus is on the heading: "This link has expired, heading level 1". Then "Reset links work for 30 minutes and only once. Ask for a new one and we'll email it to you." Then "Request a New Link, link" and "Back to sign in, link". | The same heading, line and links. |

## Flow 3: Create an order

Dev or live, with your own staff account. Name the customer TEST so the order can be found and deleted. The order is used again in flow 4 and deleted at the end of flow 4.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 3.1 | Open Orders from the side menu. Tab to the New Order link and press Enter. Phone: the Orders tab in the bottom bar, then swipe to New Order and double-tap. | "Orders, link" (the name may carry a count). The page opens with "Orders, heading level 1". Then "New Order, link". The next page has the tab title "New Order · CSPS Admin". | The same. |
| 3.2 | Find the heading. | "New Order, heading level 1". Then "Customer, dates, images and items. Payments, discounts and expenses are added on the order page after saving." The back link reads "Orders, link". | The same. |
| 3.3 | Tab through the customer fields. Phone: swipe right. | "Customer name, edit, required". "Team / organization, edit", with "Shown as the order title". "Contact number, edit, required". "Email, edit". "Address (optional), edit, multi line". | The same names, as text fields. |
| 3.4 | Tab through the order details. | "Order date, required" and the date parts as the browser reads them. "Due date, required". Once both dates are real, the due date is described as "N days from order date" or "Same day as the order date". "Status, combo box", with "Completed and Cancelled are set on the order page." "Notes, edit, multi line". | The same. |
| 3.5 | With nothing filled in, press Save Order. | Focus moves to Customer name: "Customer name, edit, invalid entry, required, Enter the customer's name." The other fields show their own errors, for example "Enter a contact number." | Focus moves to Customer name. The error "Enter the customer's name." is read with the field. |
| 3.6 | Type TEST as the customer name and any made-up contact number. Choose a due date. Tab to Add Item and press Enter. Fill the item: any product type, the description TEST jersey, Qty 2, Unit price 500. | "Add Item, button". The new row is "Item 1, group". Its fields: "Product type, combo box", "Description, edit, required", "Size / variant, edit", "Qty, edit, required", "Unit price, edit, required", then "Remove item 1, button". The summary shows "Items subtotal" marked "Preview". | The same. |
| 3.7 | Type a few letters in Notes. Press Cancel. Then press Keep Editing. | A dialog opens: "Discard changes?" with "Your changes to this order haven't been saved. If you leave now, they're lost." Buttons "Keep Editing" and "Discard Changes". Focus starts on "Keep Editing". Tab cannot reach the page behind. After Keep Editing, focus returns to the Cancel button. | The same. |
| 3.8 | Press Save Order. | The button reads "Saving". The order page opens and its heading is the order number, for example "ORD-2026-0160, heading level 1". A polite message is read: "Order saved", the order number and TEST. The tabs are read as tabs: "Items, tab, selected, 1 of 5". | The same. |

## Flow 4: Record a payment

Uses the TEST order from flow 3. The last two steps remove it. The payment is recorded against the TEST order only.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 4.1 | On the TEST order, Tab to the tab list. Press Right arrow to reach Payments. Phone: swipe to the tabs and double-tap Payments. | "Payments, tab, selected" with its count. Only the selected tab is a Tab stop. The tab content starts with "Downpayments and settlements." and the balance due. | The same. |
| 4.2 | Tab to Add Payment and press Enter. Phone: swipe to it and double-tap. | "Add Payment, button". A dialog opens: "Add Payment, dialog", described by the order number and TEST. Focus is on the first field: "Date, required". | The same. |
| 4.3 | Press Tab through the whole dialog, past the last button, and once more. | The order is: Date, Amount, Method, Reference no., Received by, Notes, Cancel, Save Payment, then Close at the top, then Date again. "Amount, edit, required" with "Balance due:" and the amount. "Method, combo box". "Reference no., edit". "Received by, combo box", with "The staff member who took the money." "Notes, edit, multi line". Tab never reaches the page behind. | The same names. Swiping stays inside the dialog. |
| 4.4 | Leave Amount empty and press Save Payment. | Focus moves to Amount: "Amount, edit, invalid entry, required, Enter the amount." Method shows "Choose a payment method." | The error "Enter the amount." is read with the Amount field. |
| 4.5 | Type 99999 as Amount and choose a Method. Press Save Payment. | Focus is on Amount. The error is read with the field: "This is more than the balance. Enter" the balance "or less." | The same. |
| 4.6 | Change Amount to 300. Press Save Payment. | The button reads "Saving". The dialog closes and focus returns to "Add Payment, button". A polite message is read: "Payment added" and "Balance now" with the new balance. | The same. |
| 4.7 | Press Add Payment. Type a few letters in Reference no. Press Escape. Phone: type, then double-tap Close at the top. | A second dialog opens over the first: "Discard changes?" with "What you typed in this window hasn't been saved. If you close it now, it's lost." Buttons "Keep Editing" and "Discard Changes". Focus starts on "Keep Editing". After Discard Changes both dialogs are closed and focus returns to "Add Payment, button". | The same. |
| 4.8 | Find the payment row. Tab to its Delete button and press Enter. Phone: swipe to it and double-tap. | The button is named "Delete payment of ₱300.00," and the date. A dialog opens: "Delete payment of ₱300.00?" then "This removes it from" the order number "and updates the totals right away." Focus is on "Cancel". Buttons "Cancel" and "Delete Payment". After confirming, a polite "Payment deleted" is read and focus does not fall to the top of the page. | The same. |
| 4.9 | Delete the TEST order. Tab to Delete Order in the order header and press Enter. | "Delete Order, button". A dialog opens: "Delete" the order number "?" Focus is on "Cancel". It says the order is "hidden from every list and total" and "A Manager can restore it." After "Delete Order": a polite message "Order" the number "deleted" and "A Manager can restore it from Deleted Orders." The Orders list opens. | The same. |
| 4.10 | Manager only. On Orders, Tab to the Deleted Orders link and press Enter. Find the TEST order. Press its permanent delete button and confirm. If your account is not a Manager, skip this and say why in Outcome. | "Deleted Orders, link". The page opens with "Deleted Orders, heading level 1". The row button reads "Delete order" the number "permanently, button". A dialog opens: "Delete" the number "permanently?" Buttons "Cancel" and "Delete Order Permanently". After confirming: a polite "Order permanently deleted" and the number. | The same. |

## Flow 5: Add an expense

Company expenses, not order expenses. Name the expense TEST. The last two steps remove it.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 5.1 | Open Company Expenses from the side menu. Phone: Expenses in the bottom bar. | "Company Expenses, link". The page opens with "Company Expenses, heading level 1" and "General business costs like rent, bills, payroll and supplies. Costs for a specific order go inside that order." The table is named "Company expenses". | The same. |
| 5.2 | Tab to Add Expense and press Enter. Phone: swipe to it and double-tap. | "Add Expense, button". A dialog opens: "Add Expense, dialog", described by "A general business cost, not tied to any order." Focus is on the first field: "Date, required". | The same. |
| 5.3 | Press Tab through the dialog, past the last button, and once more. | The order is: Date, Category, Description, Amount, Paid by, Notes, Cancel, Save Expense, then Close at the top, then Date again. "Date, required", with "Up to 30 days ahead is fine for a cost you'll pay soon." "Category, combo box", showing "Choose a category". "Description, edit, required". "Amount, edit, required". "Paid by, combo box", with "The staff member whose money paid for this." "Notes, edit, multi line", with "Optional. Shown only here. Search doesn't look in notes." Tab never reaches the page behind. | The same names. Swiping stays inside the dialog. |
| 5.4 | Leave Category and Description empty. Press Save Expense. | Focus moves to the first field with an error: "Category, combo box, invalid entry, Choose a category." The other errors are read with their fields, for example "Add a short description so others know what this was for." | The same errors are read with their fields. |
| 5.5 | Choose a category. Type TEST as Description and 640 as Amount. Press Save Expense. | The button reads "Saving". The dialog closes and focus returns to "Add Expense, button". A polite message is read: "Expense added", then "₱640.00" and the category. | The same. |
| 5.6 | Find the new row. Move along the table. | The row's buttons are named "Edit TEST," with the date, and "Delete TEST," with the date. The table is read with its column names: Date, Category, Description, Amount, Paid by, Recorded by, Actions. | The same. |
| 5.7 | Press the row's Delete button. | A dialog opens: "Delete “TEST” (₱640.00)?" then "It won't count in the expense list, totals or the payer's balance. You can restore it later from Deleted Expenses." Focus is on "Cancel". After "Delete Expense": a polite "Expense deleted" and "TEST. You can restore it from Deleted Expenses." Focus does not fall to the top of the page. | The same. |
| 5.8 | Manager only. Press the Deleted Expenses link at the top of the page. Find the TEST row and press its permanent delete button. Confirm. If your account is not a Manager, skip this and say why in Outcome. | "Deleted Expenses, link". The page opens with "Deleted Expenses, heading level 1" and a "Manager only" badge. The row button reads "Delete TEST," the date and "permanently". A dialog opens: "Delete “TEST” (₱640.00) permanently?" then "This removes the expense for good. It can't be restored, and this can't be undone. The audit log keeps its date, category, amount and payer." Buttons "Cancel" and "Delete Permanently". After confirming: a polite "Expense permanently deleted" and "TEST". | The same. |

## Flow 6: Get a Quote with photos on a phone

Phone: the live site's Contact page in Safari, with VoiceOver on. PC: NVDA on the dev site, with the browser window made narrow, about 360 px wide, so the phone layout shows. Use made-up values and a harmless test picture. Never use a real customer's details or photos. The request this flow sends is used again in flow 8.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 6.1 | Open the Contact page from the main menu. Find the page heading. NVDA: H. Phone: rotor Headings. | A heading level 1 that reads "Let's build your kit." The words "Get a quote" sit above it. The main menu is "Main, navigation" and "Contact" is the current page. | The same. On the phone the main menu may be behind a menu button. |
| 6.2 | Jump to the form by headings. | "Inquiry form, heading level 2". Then "Fields marked * are required." The form is named "Inquiry form". | The same. |
| 6.3 | Move through the fields. Tab. Phone: swipe right. | In order: "Your name, edit, required". "Team / organization, edit". "Contact number, edit, required", with "We'll text or call about your mockup." "Email, edit". "Product type, combo box", showing "Choose a product". "Quantity (estimate), combo box", showing "How many pieces?" "Message, edit, multi line". The field "Leave this field empty" is never read and never reached. | The same names, as text fields and pop-up buttons. |
| 6.4 | Reach the photo area and press the button. Phone: double-tap. Pick two small test pictures in the system picker. | "Reference photos (optional), group". Then "Choose Photos, button" and "JPG, PNG, WebP or HEIC photos, up to 10 MB each, up to 5. Have a PDF or AI file? Send it to us on Messenger." The system picker opens. | The same group, button and line. The iPhone photo picker opens. |
| 6.5 | Listen after the pictures are chosen. | Focus is on the first photo's remove button: "Remove" and the file name, "button". The list is "Photos to send, list". Each row gives the file name and size. The count line reads "2 of 5 photos". Picture previews are not read. In the narrow window the buttons "Take Photo" and "Choose Photos" are shown. | The same. The buttons "Take Photo" and "Choose Photos" are shown. |
| 6.6 | Press the first Remove button. | The photo leaves the list. Focus moves to the next photo's Remove button, or to the add control when none is left. It does not drop to the top of the page. | The same. |
| 6.7 | Try to add a file that is not a photo, such as a text file. PC: in the file window, switch the file type to all files. iPhone: if the phone will not offer a non-photo file, leave VoiceOver as Not run and say so in Outcome. | An alert is read at once: the file name, then "isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger." The file is not added. | The same alert is read at once. |
| 6.8 | Move to the notice under the photos. | "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our", then "Privacy Policy, link", then "Send Inquiry, button". | The same. |
| 6.9 | With the name empty, press Send Inquiry. | Focus moves to "Your name, edit, invalid entry, required, Enter your name." The contact number shows its own error, which starts "Enter a mobile number". | Focus moves to Your name. "Enter your name." is read with the field. |
| 6.10 | Type TEST Quote as the name, any made-up mobile number, and keep one test picture. Turn the network off (PC: turn off Wi-Fi. Phone: Airplane mode). Press Send Inquiry. | The button reads "Sending" and then "Send Inquiry" again. An alert is read at once. It starts either "Couldn't send your inquiry. Check your internet connection and try again." or "We're not sure your inquiry went through. Press Send Inquiry again." What you typed is still there. | The same. |
| 6.11 | Turn the network back on. Press Send Inquiry again. | The button reads "Sending". While the photo uploads, a polite status is read: "Sending your photos. This can take a minute on mobile data." Then focus moves to the heading "Inquiry sent, heading level 2", and "Thanks! We'll message you with a mockup and quote, usually the same day." A polite message "Inquiry sent" and "We'll message you soon." is read once, not twice. | The same. |
| 6.12 | Press Send Another. | Focus moves to "Your name, edit, required". The form is empty again. | The same. |

## Flow 7: Gallery and lightbox

Needs at least two items in the gallery. Dev: show two or more orders on the website with photos, one of them with two or more photos. The dev seed has no photos, and with none the page reads "No photos yet". Live: the real gallery. The phone tap zones appear only when the window is 767 px wide or narrower.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 7.1 | Open Gallery from the main menu. Find the heading. | A heading level 1 that reads "Worn on court & road." Then "Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close." "Gallery" is the current page in the main menu. | The same. |
| 7.2 | Tab once to reach the filter bar. Press Right arrow, Left arrow, End and Home. Phone: swipe right to the bar, then through the pills. | "Filter by category, toolbar". The first stop is the pressed pill, for example "All", its count and "items", "toggle button, pressed". Arrows move between pills and wrap at both ends. Home and End jump to the first and last. Only one pill is a Tab stop. | The toolbar and each pill read the same: name, count, "items", pressed or not. |
| 7.3 | On a pill that is not selected, press Enter or Space. Phone: double-tap. | A polite status is read: "Showing" a number "items" (or "item"). The pill is now pressed and focus stays on it. | The same. |
| 7.4 | Tab to the first picture and press Enter. Phone: swipe right to it and double-tap. | The tile is read as "Open" the team and the line, "button". The viewer opens: "Gallery image viewer, dialog". Focus is on "Close viewer, button". The hidden position is read: "Item 1 of" and the total. The picture is described as the team, the line and "work" (and "photo 1 of N" when the item has several photos). | The same. |
| 7.5 | Press Right arrow, then Left arrow, from anywhere in the viewer. On the first item press Left. | Each press reads a polite status: "Item 2 of" the total, then the team and the line. Left on the first item goes to the last, and Right on the last goes to the first. | Needs a keyboard. Without one, leave this Not run and write "no keyboard" in Outcome. |
| 7.6 | Wide window. Press Tab through the viewer. | In order: "Close viewer, button". "Previous image, button". "Next image, button". For an item with several photos, "Show photo 1 of 3, button, current" and the other photos. Then "Get a quote for something like this, link". Tab stays inside the viewer and never reaches the page behind. | On a phone the two round buttons are hidden. Leave this Not run and write "phone layout" in Outcome, or use a wide window. |
| 7.7 | Narrow window (767 px or less) or phone. Move through the viewer. Phone: from "Close viewer" swipe right. | "Close viewer, button". Then "Previous photo, button" and "Next photo, button". They are invisible buttons over the left and right thirds of the picture. The round "Previous image" and "Next image" buttons are not there. Pressing "Next photo" goes to the next item in the gallery and reads "Item 2 of" the total, the team and the line. The two buttons are named "photo" but step between gallery items. If that confuses you, say so in Outcome. | The same, with double-tap. Tapping the left third of the picture goes back and the right third goes forward. A swipe on the picture does the same. |
| 7.8 | On an item with several photos, press a thumbnail. | "Show photo 2 of 3, button". After Enter, a polite status is read: "Photo 2 of 3". The thumbnail is now marked current. The picture is described with "photo 2 of 3". | The same. |
| 7.9 | Press Escape. Phone: double-tap "Close viewer". | The viewer closes. Focus goes back to the tile of the item you were last on: "Open" the team and the line, "button". The page is usable again. | The same. |
| 7.10 | Open the viewer again. Tab to "Get a quote for something like this" and press Enter. Phone: swipe to it and double-tap. | The viewer closes and the Contact page opens. "Product type" shows the line of the item you were on. | The same. |
| 7.11 | Only if the gallery has more than 24 items. Tab to "Show More Photos" and press Enter. Otherwise write "fewer than 24 items" in Outcome. | "Show More Photos, button". Focus moves to the first new tile: "Open" the team and the line, "button". | The same. |

## Flow 8: Quote inbox to order

Staff account on both. Needs the test request from flow 6, which still has its photos. Dev: the path ends with a Converted request, which is fine on a dev database. Live: the request is never converted. It ends marked Spam, as 14 D-10 says, because a Converted request cannot be marked Spam or deleted.

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 8.1 | Open Quote Requests from the side menu. Phone: the bottom bar, Quotes. | "Quote Requests, link" (the name may carry a count). The page opens with "Quote Requests, heading level 1" and "Requests sent from the Get a Quote form on the website." | The same. |
| 8.2 | Tab to the status pills. Use the arrow keys and Enter. Phone: swipe right and double-tap. | "Show, toolbar". The pills are Open, Converted, Closed, Spam and All, each with a count and "requests". The chosen pill is "pressed". Only one pill is a Tab stop. Arrows move and Enter selects. | The same. |
| 8.3 | Tab to the search box and type TEST. | "Search requests, edit", with the placeholder "Name, team or phone". | The same. |
| 8.4 | Read the table. NVDA: Ctrl+Alt+arrows. Phone: swipe right row by row. | The table is named "Quote requests". Columns: Received, Name, Phone, Product, Pieces, Photos, Status. The name is a link. When a photo did not arrive the Photos cell reads for example "2 of 3 photos arrived". | The same. |
| 8.5 | Press Enter on the TEST request's name. Phone: double-tap. | The tab title is "Quote Request · CSPS Admin". The heading is the customer name, heading level 1. Then "Received" the time "from the website" and the status "New". The back link is "Quote Requests, link". | The same. |
| 8.6 | Move through the cards. NVDA: Tab and the arrows. Phone: swipe right. | The cards are "Request" (Team / organization, Contact number, Email, Product type, Quantity (estimate), Message), "Photos" ("Request photos, list"), "Internal notes" and "History" ("Received from the website"). | The same. |
| 8.7 | In Internal notes, press Add Note with the box empty. Then type TEST note and press Add Note. | "Add a note, edit", with "Only staff see these. A note can't be changed or removed after it's added." Empty: "Write a note first." is read with the box. After adding: the button reads "Adding" and then a polite "Note added." is read. The note appears in the list. | The same. |
| 8.8 | Tab to Change Status and press Enter. Press Down arrow, Up arrow, then Escape. Phone: double-tap, swipe, then scrub with two fingers to close. | "Change Status, menu button, collapsed". After Enter: "menu" and the first item, "Move to Contacted, menu item". The items are Contacted, Quoted, Closed and Spam (not New, which is the current status, and never Converted). Escape closes the menu and focus returns to "Change Status, menu button". | The same. The scrub closes the menu. |
| 8.9 | Choose Move to Spam. The request must still have photos. First press Cancel in the dialog. Then do it again and press Mark as Spam. | A dialog opens: "Mark this request as spam?" then "Its" a number "photos will be deleted within a day and can't be brought back. The request text stays until it's cleaned up after 6 months." Focus is on "Cancel". After Cancel, focus returns to "Change Status". After "Mark as Spam": the button reads "Marking" and a polite "Status changed" and "This request is now Spam." is read. The Photos card says "The photos were deleted when this request was marked as spam." | The same. |
| 8.10 | Open Change Status and choose Move to New. | A polite "Status changed" and "This request is now New." is read. The photos stay deleted. | The same. |
| 8.11 | Press Turn into Order. | "Turn into Order, link". The New Order form opens with the customer's details filled in. A note is read: "Filled in from the quote request from" the name ", received" the date ". Add the items and prices, then save." Then "View Request, link". | The same. |
| 8.12 | Dev: add one item (TEST, Qty 1, Unit price 100) and press Save Order. Live: do not save. Press Cancel, and Discard Changes if asked, then open the request again. | Dev: the button reads "Saving", the order page opens and a polite message is read: "Order saved" and "The quote request is now Converted." On the request page the link "Open Order" and the order number is there and Change Status is gone. Live: "Discard changes?" is read, and after Discard Changes the request is still New. | The same. |
| 8.13 | Live: open Change Status and choose Move to Spam. There is no dialog, because the photos are already gone. Dev: find Delete Request (Manager only). | Live: a polite "Status changed" and "This request is now Spam." is read. Dev: "Delete Request, button, unavailable", described by "A request that became an order can't be deleted." | Live: the same status is read. The dev part does not apply on the phone. |

## Results

Every result starts as "Not run". Fill in the Keyboard, NVDA and VoiceOver columns with Pass, Fail or Not run. A Fail needs an Outcome. A step that was run needs a date.

| Flow | Step | Keyboard | NVDA | VoiceOver | Outcome | Date |
|---|---|---|---|---|---|---|
| Flow 1 | 1.1 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.2 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.3 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.4 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.5 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.6 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.7 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.8 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.9 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.10 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.11 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.12 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.13 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.14 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.15 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.16 | Not run | Not run | Not run |  |  |
| Flow 1 | 1.17 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.1 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.2 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.3 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.4 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.5 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.6 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.7 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.8 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.9 | Not run | Not run | Not run |  |  |
| Flow 2 | 2.10 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.1 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.2 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.3 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.4 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.5 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.6 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.7 | Not run | Not run | Not run |  |  |
| Flow 3 | 3.8 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.1 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.2 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.3 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.4 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.5 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.6 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.7 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.8 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.9 | Not run | Not run | Not run |  |  |
| Flow 4 | 4.10 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.1 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.2 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.3 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.4 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.5 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.6 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.7 | Not run | Not run | Not run |  |  |
| Flow 5 | 5.8 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.1 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.2 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.3 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.4 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.5 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.6 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.7 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.8 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.9 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.10 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.11 | Not run | Not run | Not run |  |  |
| Flow 6 | 6.12 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.1 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.2 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.3 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.4 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.5 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.6 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.7 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.8 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.9 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.10 | Not run | Not run | Not run |  |  |
| Flow 7 | 7.11 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.1 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.2 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.3 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.4 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.5 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.6 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.7 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.8 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.9 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.10 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.11 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.12 | Not run | Not run | Not run |  |  |
| Flow 8 | 8.13 | Not run | Not run | Not run |  |  |

## Sign-off

When every step has a result and every Fail has an outcome, read this page and reply "signed" in chat. Claude then adds one line at the end of this section, in the form `Signed: owner, yyyy-MM-dd`, with no name, email or device id (14 D-22).

Not signed yet.
