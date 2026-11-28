# Runbook: a request to see, fix or delete someone's data

*Created: 2026-11-27T20:56:00-06:00 · Updated: 2026-11-27T20:56:00-06:00*

A customer or a visitor can ask to see the information we hold about them, to fix it, or to have it deleted (LEGAL-06, the Privacy Policy section "Your rights"). This page is the step-by-step way to answer, using only the screens the app has today. No new screen or button is needed.

Claude is not a lawyer. This page is not legal advice. Anything that touches the law, such as a refusal or a complaint to the National Privacy Commission (NPC), goes to the owner, who can confirm it with the NPC or an adviser.

## Who handles requests

- **The owner is the Data Protection Officer.** Every request is brought to the owner.
- **A Manager does the day-to-day steps** on this page: checking who is asking, looking up the data, sending a copy, and deleting quote requests. Only a Manager can use Delete Request.
- **The answer time is 15 days** from the day the request arrives. Write the arrival date in your note to the owner, and answer well before the 15 days end.
- Put no name, email address or phone number of the person in git, in this page, or in chat with Claude. Work in the admin area and the shop mailbox only.

## Check who is asking

We must not give one person's data to someone else.

1. Act only on a request that comes **from the email address or phone number already on that person's quote request or order**. A reply sent from that email, or a message from that phone, also counts.
2. If the request comes from anywhere else, send **one polite question** and share nothing yet. Ask them to send the request again from the email or phone number they used with us, or to reply to the shop's earlier message. Use the first reply template below.
3. **No ID photo is asked for or kept.** Never ask for a photo of an ID, a card or a face. If someone sends one anyway, do not save or forward it. Delete it from the shop mailbox and tell the person it was not needed.
4. Do not say whether we hold anything about them until the check passes.

## See their data

The app has no export for one person. A Manager reads the screens and writes the answer by hand.

1. Open **Quote Requests**. In the Search box, type the name, team or phone number. Pick **All** in the status pills, so Closed and Spam requests show too. (The search does not look at email, so try the phone number as well.)
2. Open each request. It holds the name, team, phone, email, the message, the product and number of pieces, the photos they sent, the staff notes and the status history.
3. Open **Orders**. Search by order number, customer, team or phone. Each order holds the customer's name, team, contact number, email and address, the order dates and notes, items, payments, and any order photos.
4. Write the answer in an email **from the shop mailbox**, not from the app's no-reply sender (nobody reads replies sent to it). Send it only to the email address or phone number on record. List what we hold for that person, request by request and order by order. Never include another person's details.
5. Staff notes on a request are about the person. Ask the owner what to include from them before you send.
6. Tell the owner the request, the date it arrived, and what you sent.

## Fix their data

| What is wrong | What to do today |
|---|---|
| A detail on an **order** (name, team, contact number, email, address, notes) | Open the order, then **Edit Details**. Change the field and save. The audit log records the change. |
| A detail on a **quote request** (name, team, phone, email, message) | **No screen edits these.** A request only takes a status change and a note. Add an internal note that gives the corrected detail (a note cannot be changed or removed afterward), then tell the owner. If the request has not become an order and the person agrees, the other way is to delete it (next section) and ask them to send the quote form again. |
| A wrong detail in the shop mailbox | Fix or delete it by hand. |

The missing quote-request edit is a gap, not a Manager mistake. It is listed for the owner to decide whether a screen should be built. Nothing is built for it in this phase.

## Delete their data

A deletion request covers **quote requests**. Orders, payments and other money records stay, for the reasons in the next section.

1. Check who is asking (above).
2. Open **Quote Requests**, search with **All** selected, and open each request of that person.
3. If the status is **Converted** (the request became an order), stop here for that request. It stays with its order. The button is refused with "A request that became an order can't be deleted." Use the second reply template.
4. Otherwise choose **Delete Request**, then confirm **Delete Request** again. This is a Manager-only action. It deletes the request, its notes, its history and its photo records for good. It cannot be undone.
5. The photos are queued for removal. The daily maintenance run (see [maintenance.md](maintenance.md)) deletes them from photo storage.
6. **Delete the quote alert emails from the shop mailbox by hand.** Every new quote request sends the staff an alert. Its subject holds the person's name, and its body holds up to 300 characters of their message. Search the shop mailbox for the subject "New quote request from" and the person's name, and delete each alert. Do this for every alert that staff forwarded, too. The app cannot do this for you.
7. Nothing to do for copies of emails in the app's outbox. They are cleared automatically within 30 days of the email being closed (the rule is in [mail-setup.md](mail-setup.md)).
8. The audit entry for the delete holds only the request's status and how many photos it had. It holds no name, phone or email. Audit entries are removed after 8 months (see [audit-log.md](audit-log.md)).
9. If you find other copies (a screenshot, a message on a phone, a printed page), tell the owner. Do not decide alone.
10. Send the reply, and tell the owner what was deleted and what was kept.

Do not use Delete or Delete Permanently on an order to answer a data request. The owner has ruled that no "remove personal details" action exists.

## What we keep and why

| What | What we do | Why |
|---|---|---|
| Orders, payments, discounts and expenses | **Kept for good** | They are our bookkeeping and tax records. The Privacy Policy says so, and the law says we must keep them. |
| A quote request that became an order, and its photos | **Kept as long as the order** | It is part of that order's record. The Privacy Policy says so. |
| A quote request that did not become an order, and its photos | **Deleted** on request | Nothing requires us to keep it. |
| Quote alert emails in the shop mailbox | **Deleted by hand** | The app cannot reach the mailbox. |
| Audit entries | Kept up to 8 months | They hold no customer details. |

The Privacy Policy wording is the owner's to change. If a request shows that the wording is wrong or unclear, tell the owner. Do not edit the policy.

## Reply templates

Fill in the blanks. Keep the words short and plain. Send the reply from the shop mailbox, to the email or phone number on record.

**One polite question (the request came from somewhere else)**

> Hello. Thank you for your message. To protect your information, we only answer from the email address or phone number you gave us on your quote request or order. Please send your request again from that address or number, or reply to our earlier message. We do not need a photo of an ID. We will answer within 15 days after we hear from you.

**Deleted, and what we kept**

> Hello. We deleted your quote requests and the photos you sent with them. We also deleted the alert emails we received about them.
>
> We kept your orders and payment records. They are our bookkeeping and tax records, and the law says we must keep them. [If a request became an order:] Your quote request for order [number] stays with that order, because it is part of the same record. We will keep it only as long as the order.
>
> If you have questions, reply to this message. You may also complain to the National Privacy Commission at privacy.gov.ph.

**Sent what we hold (access)**

> Hello. Here is the information we hold about you: [list]. If something is wrong, tell us and we will fix it.

## Two people at once

One person logs each request. Say who has it in your note to the owner before you start, so two Managers do not both work on it.

If two Managers act at the same time, no harm is done:

- Opening a request that is already deleted shows "Quote request not found". That means it is gone, so skip it.
- A delete from a screen that is out of date is refused with "Someone else changed this request." Load the latest and look again.
- A request that became an order meanwhile is refused, and stays.
