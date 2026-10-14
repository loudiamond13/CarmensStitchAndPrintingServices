// SPEC-GAP: site contact config (UI-SPEC Layout Contract "Footer", spec §0 rule 5). The footer's contact details in
// one typed module, so no JSX carries a bracketed placeholder. Phase 2 keeps the App. E.1 placeholders as they are, and
// the links stay `#`; the public-site phase binds every value here to SiteSettings.

/** One footer link: the text a visitor reads and where it goes. */
export interface ContactLink {
  readonly text: string;
  readonly href: string;
}

export interface SiteContact {
  /** The "Visit" address line. */
  readonly address: string;
  /** The "Visit" opening hours line. */
  readonly hours: string;
  readonly phone: ContactLink;
  readonly messenger: ContactLink;
  readonly email: ContactLink;
  /** The social profile pages (the FB, IG and TT squares). */
  readonly social: {
    readonly facebook: string;
    readonly instagram: string;
    readonly tiktok: string;
  };
}

/** The footer's contact details (App. E.1 copy; the brackets mark values the owner has not given yet). */
export const SITE_CONTACT: SiteContact = {
  address: '[Shop address], [City], Philippines',
  hours: 'Mon-Sat · 9:00 AM - 6:00 PM',
  phone: { text: '[0917 000 0000]', href: '#' },
  messenger: { text: 'Message us on Messenger', href: '#' },
  email: { text: '[hello@yourdomain.ph]', href: '#' },
  social: { facebook: '#', instagram: '#', tiktok: '#' },
};
