# Manual accessibility passes: keyboard, NVDA and VoiceOver

*Created: 2026-11-27T21:18:50-06:00 · Updated: 2026-11-27T21:18:50-06:00*

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

Be careful with the sign-in code (flow 1). Too many wrong codes pause sign-in for 15 minutes. Use one wrong code, once.

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

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 2.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 2.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 2.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 3: Create an order

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 3.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 3.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 3.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 4: Record a payment

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 4.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 4.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 4.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 5: Add an expense

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 5.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 5.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 5.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 6: Get a Quote with photos on a phone

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 6.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 6.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 6.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 7: Gallery and lightbox

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 7.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 7.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 7.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

## Flow 8: Quote inbox to order

| Step | Do | NVDA should say | VoiceOver should say |
|---|---|---|---|
| 8.1 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 8.2 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |
| 8.3 | To be scripted in Task 2 | To be scripted in Task 2 | To be scripted in Task 2 |

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

## Sign-off

When every step has a result and every Fail has an outcome, read this page and reply "signed" in chat. Claude then adds one line at the end of this section, in the form `Signed: owner, yyyy-MM-dd`, with no name, email or device id (14 D-22).

Not signed yet.
