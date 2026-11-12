// What the public layout hands to its page through the router's outlet context: the shop facts a page part needs without
// reading the facts hook itself (the layout already reads it for the footer).

export interface PublicOutletContext {
  /** The Messenger link, or null when none is set. */
  readonly messengerUrl: string | null;
  /** The Business Info turnaround line, or null when none is typed or the facts have not loaded. */
  readonly turnaroundLine: string | null;
}
