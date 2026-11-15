namespace Csps.Domain.Auditing;

/// <summary>
/// The audit action codes (AUDIT-01, USER-06). Each is a dotted lowercase code that <see cref="AuditEntry"/>
/// accepts. Entries reference people by user id only: never an e-mail address, name, code, token or password.
/// </summary>
public static class AuditActions
{
    /// <summary>A sign-in attempt failed; the detail is one of <see cref="SignInFailureReasons"/>.</summary>
    public const string SignInFailed = "auth.sign-in-failed";

    /// <summary>An account was locked after repeated failures; the detail is one of <see cref="LockoutDetails"/>.</summary>
    public const string Lockout = "auth.lockout";

    /// <summary>A sign-in code was created and e-mailed.</summary>
    public const string TwoFactorIssued = "auth.2fa-issued";

    /// <summary>A new sign-in code was requested.</summary>
    public const string TwoFactorResent = "auth.2fa-resent";

    /// <summary>A sign-in code was entered correctly.</summary>
    public const string TwoFactorVerified = "auth.2fa-verified";

    /// <summary>A wrong sign-in code was entered.</summary>
    public const string TwoFactorFailed = "auth.2fa-failed";

    /// <summary>A sign-in code ran out of attempts.</summary>
    public const string TwoFactorExhausted = "auth.2fa-exhausted";

    /// <summary>A sign-in completed and a session started.</summary>
    public const string SignedIn = "auth.signed-in";

    /// <summary>A used refresh token was presented again, so the session was revoked.</summary>
    public const string RefreshReuseDetected = "auth.refresh-reuse-detected";

    /// <summary>A user signed out of the current session.</summary>
    public const string SignedOut = "auth.signed-out";

    /// <summary>Several sessions were revoked at once; the detail is one of <see cref="SessionsRevokedDetails"/>.</summary>
    public const string SessionsRevoked = "auth.sessions-revoked";

    /// <summary>One session was revoked.</summary>
    public const string SessionRevoked = "auth.session-revoked";

    /// <summary>A password reset was requested.</summary>
    public const string PasswordResetRequested = "auth.password-reset-requested";

    /// <summary>A password reset was completed.</summary>
    public const string PasswordResetCompleted = "auth.password-reset-completed";

    /// <summary>A reset link was used that is unknown, expired or already used.</summary>
    public const string PasswordResetLinkInvalid = "auth.password-reset-link-invalid";

    /// <summary>A password was changed: the must-change step after the sign-in code, or a person's own change from My Profile.</summary>
    public const string PasswordChanged = "auth.password-changed";

    /// <summary>A chosen password was refused because it appears in a known breach, or a saved one was found in a breach at sign-in (D-18).</summary>
    public const string PasswordBreachFound = "auth.password-breach-found";

    /// <summary>The breached-password lookup could not be reached.</summary>
    public const string BreachCheckUnavailable = "auth.breach-check-unavailable";

    /// <summary>An invited user set a password and activated the account.</summary>
    public const string InviteAccepted = "auth.invite-accepted";

    /// <summary>The first Manager account was created by the bootstrap command.</summary>
    public const string BootstrapManagerCreated = "user.bootstrap-manager-created";

    /// <summary>A user was invited.</summary>
    public const string UserInvited = "user.invited";

    /// <summary>A Manager created a user with a temporary password; no detail, and never the password (D-14, D-40).</summary>
    public const string UserCreatedTemporary = "user.created-temporary";

    /// <summary>A Manager deactivated a user; no detail (D-40).</summary>
    public const string UserDeactivated = "user.deactivated";

    /// <summary>A Manager reactivated a user; no detail (D-40).</summary>
    public const string UserActivated = "user.activated";

    /// <summary>A Manager locked a user until a Manager unlocks them; no detail (D-16, D-40).</summary>
    public const string UserLocked = "user.locked";

    /// <summary>A Manager lifted a user's Manager lock; no detail (D-16, D-40).</summary>
    public const string UserUnlocked = "user.unlocked";

    /// <summary>A Manager deleted a user for good (soft delete, D-07); no detail, and never the name or address (D-40).</summary>
    public const string UserDeleted = "user.deleted";

    /// <summary>A Manager changed another person's first or last name or sign-in email; the detail lists the changed fields, never the values (D-40).</summary>
    public const string UserDetailsChanged = "user.details-changed";

    /// <summary>A Manager changed another person's role; the detail is <c>role=old&gt;new</c> in lower case, never a name (D-40).</summary>
    public const string UserRoleChanged = "user.role-changed";

    /// <summary>A Manager started a confirm-by-link email change for another person; no detail and no address (C-9, D-40).</summary>
    public const string UserEmailChangeStarted = "user.email-change-started";

    /// <summary>A new invitation replaced the old one, because the invited person's address moved or a Manager sent it again; no detail (D-40).</summary>
    public const string UserInvitationResent = "user.invitation-resent";

    /// <summary>A Manager emailed a person a password reset link; no detail, never the link (USER-07, D-40).</summary>
    public const string UserResetLinkSent = "user.reset-link-sent";

    /// <summary>A Manager set a temporary password for a person; no detail, and never the password (C-4, D-14, D-40).</summary>
    public const string UserTemporaryPasswordSet = "user.temporary-password-set";

    /// <summary>A signed-in user changed their own first or last name; the detail lists the changed fields, never the names (D-40).</summary>
    public const string ProfileNameChanged = "profile.name-changed";

    /// <summary>A signed-in user asked to change their sign-in email; no detail and no address (D-40).</summary>
    public const string ProfileEmailChangeRequested = "profile.email-change-requested";

    /// <summary>A new sign-in email was confirmed and applied; no detail and no address (D-40).</summary>
    public const string ProfileEmailChanged = "profile.email-changed";

    /// <summary>A waiting email change was called off; the detail is none, or <c>taken</c> when the address was taken first (D-40).</summary>
    public const string ProfileEmailChangeCanceled = "profile.email-change-canceled";

    /// <summary>A company expense was added (D-27).</summary>
    public const string CompanyExpenseAdded = "company-expense.added";

    /// <summary>A company expense's amount, date, category, description or notes changed (D-27).</summary>
    public const string CompanyExpenseChanged = "company-expense.changed";

    /// <summary>A company expense's payer changed (D-27).</summary>
    public const string CompanyExpensePayerChanged = "company-expense.payer-changed";

    /// <summary>A company expense was deleted into the bin (D-27).</summary>
    public const string CompanyExpenseDeleted = "company-expense.deleted";

    /// <summary>A deleted company expense was restored (D-27).</summary>
    public const string CompanyExpenseRestored = "company-expense.restored";

    /// <summary>A deleted company expense was removed for good (D-27).</summary>
    public const string CompanyExpensePermanentlyDeleted = "company-expense.permanently-deleted";

    /// <summary>A staff member transferred money to a coworker (D-111).</summary>
    public const string MoneyTransferAdded = "money-transfer.added";

    /// <summary>A staff money transfer was deleted into the bin (D-23).</summary>
    public const string MoneyTransferDeleted = "money-transfer.deleted";

    /// <summary>A deleted staff money transfer was removed for good (D-24).</summary>
    public const string MoneyTransferPermanentlyDeleted = "money-transfer.permanently-deleted";

    /// <summary>A Manager handed money from a former staff member to a coworker (D-17).</summary>
    public const string MoneyHandedOver = "money-transfer.handed-over";

    /// <summary>A Manager saved the business info; the detail names the changed fields (CONT-01).</summary>
    public const string SiteSettingsChanged = "site-settings.changed";

    /// <summary>A Manager saved the weekly opening hours; the detail names each changed day with its old and new times (CONT-01).</summary>
    public const string OpeningHoursChanged = "opening-hours.changed";

    /// <summary>A Manager added a holiday or closure; the detail holds its first and last day and says when a note was set, never the note (CONT-04).</summary>
    public const string ShopClosureAdded = "shop-closure.added";

    /// <summary>A Manager changed a closure; the detail holds the old and new days and says when the note changed, never the note (CONT-04).</summary>
    public const string ShopClosureChanged = "shop-closure.changed";

    /// <summary>A Manager deleted a closure; the detail holds its first and last day (CONT-04).</summary>
    public const string ShopClosureDeleted = "shop-closure.deleted";

    /// <summary>A Manager added a product line; the detail holds its key and title (CONT-02).</summary>
    public const string ProductLineAdded = "product-line.added";

    /// <summary>A Manager changed a product line; the detail names the changed fields and holds the old and new title, short name, price and minimum, never the long texts (CONT-02).</summary>
    public const string ProductLineChanged = "product-line.changed";

    /// <summary>A Manager moved a product line in the display order; the detail holds the old and new position (CONT-02).</summary>
    public const string ProductLineMoved = "product-line.moved";

    /// <summary>A Manager hid a product line (CONT-02, D-08).</summary>
    public const string ProductLineHidden = "product-line.hidden";

    /// <summary>A Manager showed a product line (CONT-02).</summary>
    public const string ProductLineShown = "product-line.shown";

    /// <summary>A Manager deleted an unused product line (CONT-02, D-08).</summary>
    public const string ProductLineDeleted = "product-line.deleted";

    /// <summary>A Manager added, replaced or removed a photo of a product line; the detail holds the line key and title, the slot and the change, never the address (D-02).</summary>
    public const string ProductLinePhotoChanged = "product-line.photo-changed";

    /// <summary>A Manager added a testimonial (CONT-03). The detail names the person, never the words.</summary>
    public const string TestimonialAdded = "testimonial.added";

    /// <summary>A Manager changed a testimonial. The detail names the changed fields and never copies the quote or the team line.</summary>
    public const string TestimonialChanged = "testimonial.changed";

    /// <summary>A Manager moved a testimonial in the order.</summary>
    public const string TestimonialMoved = "testimonial.moved";

    /// <summary>A Manager took a testimonial off the Home page.</summary>
    public const string TestimonialHidden = "testimonial.hidden";

    /// <summary>A Manager put a testimonial back on the Home page.</summary>
    public const string TestimonialShown = "testimonial.shown";

    /// <summary>A Manager deleted a testimonial.</summary>
    public const string TestimonialDeleted = "testimonial.deleted";

    /// <summary>A Manager added a gallery photo for older work (GAL-03). The detail holds the team and the line title, never the address.</summary>
    public const string GalleryPhotoAdded = "gallery-photo.added";

    /// <summary>A Manager changed a gallery upload or replaced its photo. The detail names the changed fields and never copies the note.</summary>
    public const string GalleryPhotoChanged = "gallery-photo.changed";

    /// <summary>A Manager took a gallery upload off the website.</summary>
    public const string GalleryPhotoHidden = "gallery-photo.hidden";

    /// <summary>A Manager put a gallery upload on the website.</summary>
    public const string GalleryPhotoShown = "gallery-photo.shown";

    /// <summary>A Manager deleted a gallery upload.</summary>
    public const string GalleryPhotoDeleted = "gallery-photo.deleted";

    /// <summary>A Manager moved an item (an order or an upload) in the gallery order (GAL-03).</summary>
    public const string GalleryItemMoved = "gallery-item.moved";

    /// <summary>A Manager added, replaced or removed the default link preview picture; the detail holds the change and never the address (D-26).</summary>
    public const string SharePictureChanged = "site-settings.share-picture-changed";

    /// <summary>Staff recorded that the customer said OK to show an order on the website (D-11). The detail names the order, never the customer.</summary>
    public const string OrderPublicConsentRecorded = "order.public-consent-recorded";

    /// <summary>Staff removed the customer's OK to show an order; the order also leaves the website (D-11, D-15).</summary>
    public const string OrderPublicConsentRemoved = "order.public-consent-removed";

    /// <summary>Staff put an order on the website (D-16).</summary>
    public const string OrderShownOnWebsite = "order.shown-on-website";

    /// <summary>An order came off the website: staff took it off or removed the customer's OK (D-15).</summary>
    public const string OrderTakenOffWebsite = "order.taken-off-website";

    /// <summary>Staff changed the line or the name an order is shown under; the detail names the fields, never the words (D-09, D-13).</summary>
    public const string OrderPublicDetailsChanged = "order.public-details-changed";

    /// <summary>A Manager filed an order product type under a product line, moved it to another line or took it off its line; the detail holds the old and new line titles (D-09).</summary>
    public const string ProductTypeLineLinked = "product-type.line-linked";

    /// <summary>An expense category was added (D-27).</summary>
    public const string ExpenseCategoryAdded = "expense-category.added";

    /// <summary>An expense category was renamed (D-27).</summary>
    public const string ExpenseCategoryRenamed = "expense-category.renamed";

    /// <summary>An expense category's tone changed (D-27).</summary>
    public const string ExpenseCategoryRecolored = "expense-category.recolored";

    /// <summary>An expense category was retired (D-27).</summary>
    public const string ExpenseCategoryRetired = "expense-category.retired";

    /// <summary>A retired expense category was reactivated (D-27).</summary>
    public const string ExpenseCategoryReactivated = "expense-category.reactivated";

    /// <summary>An unused expense category was deleted (D-27).</summary>
    public const string ExpenseCategoryDeleted = "expense-category.deleted";

    /// <summary>An order was created (D-31).</summary>
    public const string OrderCreated = "order.created";

    /// <summary>An order's dates or customer details changed; the detail names fields, never customer text (D-31).</summary>
    public const string OrderChanged = "order.changed";

    /// <summary>An order moved to another status (D-31).</summary>
    public const string OrderStatusChanged = "order.status-changed";

    /// <summary>A completed or cancelled order was reopened (D-31).</summary>
    public const string OrderReopened = "order.reopened";

    /// <summary>An order was deleted into the bin (D-31).</summary>
    public const string OrderDeleted = "order.deleted";

    /// <summary>A deleted order was restored (D-31).</summary>
    public const string OrderRestored = "order.restored";

    /// <summary>A deleted order was removed for good; the detail keeps its totals, never customer details (D-29, D-31).</summary>
    public const string OrderPermanentlyDeleted = "order.permanently-deleted";

    /// <summary>An item was added to an order (D-31).</summary>
    public const string OrderItemAdded = "order-item.added";

    /// <summary>An order item changed (D-31).</summary>
    public const string OrderItemChanged = "order-item.changed";

    /// <summary>An order item was removed (D-31).</summary>
    public const string OrderItemRemoved = "order-item.removed";

    /// <summary>A photo was added to an order; the detail names the order number and the photo's 1-based position, never its id or address (D-19).</summary>
    public const string OrderImageAdded = "order-image.added";

    /// <summary>A photo was moved to another place; the detail names the order number and the 1-based places it moved from and to, never its id or address (D-19).</summary>
    public const string OrderImageMoved = "order-image.moved";

    /// <summary>The cover photo of an order changed; the detail names the order number and the 1-based place the new cover had before the move (D-14, D-19).</summary>
    public const string OrderImageCoverChanged = "order-image.cover-changed";

    /// <summary>A photo's description changed; the detail names the order number, the 1-based place and the old and new text, never the photo's id or address (D-12, D-19).</summary>
    public const string OrderImageDescriptionChanged = "order-image.description-changed";

    /// <summary>A photo was deleted from an order; the detail names the order number and the 1-based place it had, never its id or address (D-19).</summary>
    public const string OrderImageDeleted = "order-image.deleted";

    /// <summary>A payment was added to an order (D-31).</summary>
    public const string OrderPaymentAdded = "order-payment.added";

    /// <summary>An order payment changed (D-31).</summary>
    public const string OrderPaymentChanged = "order-payment.changed";

    /// <summary>An order payment's receiver changed (D-31).</summary>
    public const string OrderPaymentReceiverChanged = "order-payment.receiver-changed";

    /// <summary>An order payment was removed (D-31).</summary>
    public const string OrderPaymentRemoved = "order-payment.removed";

    /// <summary>A refund was added to an order (D-31).</summary>
    public const string OrderRefundAdded = "order-refund.added";

    /// <summary>An order refund changed (D-31).</summary>
    public const string OrderRefundChanged = "order-refund.changed";

    /// <summary>An order refund's refunder changed (D-31).</summary>
    public const string OrderRefundRefunderChanged = "order-refund.refunder-changed";

    /// <summary>An order refund was removed (D-31).</summary>
    public const string OrderRefundRemoved = "order-refund.removed";

    /// <summary>A discount was added to an order (D-31).</summary>
    public const string OrderDiscountAdded = "order-discount.added";

    /// <summary>An order discount changed (D-31).</summary>
    public const string OrderDiscountChanged = "order-discount.changed";

    /// <summary>An order discount was removed (D-31).</summary>
    public const string OrderDiscountRemoved = "order-discount.removed";

    /// <summary>An expense was added to an order (D-31).</summary>
    public const string OrderExpenseAdded = "order-expense.added";

    /// <summary>An order expense changed (D-31).</summary>
    public const string OrderExpenseChanged = "order-expense.changed";

    /// <summary>An order expense's payer changed (D-31).</summary>
    public const string OrderExpensePayerChanged = "order-expense.payer-changed";

    /// <summary>An order expense was removed (D-31).</summary>
    public const string OrderExpenseRemoved = "order-expense.removed";

    /// <summary>A product type was added (D-31).</summary>
    public const string ProductTypeAdded = "product-type.added";

    /// <summary>A product type was renamed (D-31).</summary>
    public const string ProductTypeRenamed = "product-type.renamed";

    /// <summary>A product type's tone changed (D-31).</summary>
    public const string ProductTypeRecolored = "product-type.recolored";

    /// <summary>A product type was retired (D-31).</summary>
    public const string ProductTypeRetired = "product-type.retired";

    /// <summary>A retired product type was reactivated (D-31).</summary>
    public const string ProductTypeReactivated = "product-type.reactivated";

    /// <summary>An unused product type was deleted (D-31).</summary>
    public const string ProductTypeDeleted = "product-type.deleted";

    /// <summary>A payment method was added (D-31).</summary>
    public const string PaymentMethodAdded = "payment-method.added";

    /// <summary>A payment method was renamed (D-31).</summary>
    public const string PaymentMethodRenamed = "payment-method.renamed";

    /// <summary>A payment method's tone changed (D-31).</summary>
    public const string PaymentMethodRecolored = "payment-method.recolored";

    /// <summary>A payment method was retired (D-31).</summary>
    public const string PaymentMethodRetired = "payment-method.retired";

    /// <summary>A retired payment method was reactivated (D-31).</summary>
    public const string PaymentMethodReactivated = "payment-method.reactivated";

    /// <summary>An unused payment method was deleted (D-31).</summary>
    public const string PaymentMethodDeleted = "payment-method.deleted";

    /// <summary>An order expense category was added (D-31).</summary>
    public const string OrderExpenseCategoryAdded = "order-expense-category.added";

    /// <summary>An order expense category was renamed (D-31).</summary>
    public const string OrderExpenseCategoryRenamed = "order-expense-category.renamed";

    /// <summary>An order expense category's tone changed (D-31).</summary>
    public const string OrderExpenseCategoryRecolored = "order-expense-category.recolored";

    /// <summary>An order expense category was retired (D-31).</summary>
    public const string OrderExpenseCategoryRetired = "order-expense-category.retired";

    /// <summary>A retired order expense category was reactivated (D-31).</summary>
    public const string OrderExpenseCategoryReactivated = "order-expense-category.reactivated";

    /// <summary>An unused order expense category was deleted (D-31).</summary>
    public const string OrderExpenseCategoryDeleted = "order-expense-category.deleted";

    /// <summary>Sign-in failure detail: no account has that email.</summary>
    public const string DetailUnknownAccount = "unknown-account";

    /// <summary>Sign-in failure detail: the password did not match.</summary>
    public const string DetailBadPassword = "bad-password";

    /// <summary>Sign-in failure detail: the account is locked after repeated failures.</summary>
    public const string DetailLocked = "locked";

    /// <summary>Sign-in failure and reset-request detail: the account is deactivated.</summary>
    public const string DetailDeactivated = "deactivated";

    /// <summary>Sign-in failure detail: the invitation was never accepted.</summary>
    public const string DetailUnconfirmed = "unconfirmed";

    /// <summary>Sign-in failure detail: the account has no password yet.</summary>
    public const string DetailNoPassword = "no-password";

    /// <summary>Sign-in failure and reset-request detail: a Manager locked the account.</summary>
    public const string DetailManagerLocked = "manager-locked";

    /// <summary>Sign-in failure detail: the account was deleted.</summary>
    public const string DetailDeleted = "deleted";

    /// <summary>Lockout detail: too many wrong passwords.</summary>
    public const string DetailPassword = "password";

    /// <summary>Lockout detail: too many wrong sign-in codes.</summary>
    public const string DetailCode = "code";

    /// <summary>Sessions-revoked detail: the person signed out their other sessions.</summary>
    public const string DetailSignOutOthers = "sign-out-others";

    /// <summary>Sessions-revoked detail: a password reset finished.</summary>
    public const string DetailPasswordReset = "password-reset";

    /// <summary>Sessions-revoked detail: the person changed their password.</summary>
    public const string DetailPasswordChanged = "password-changed";

    /// <summary>Sessions-revoked detail: a Manager changed the account.</summary>
    public const string DetailAccountChanged = "account-changed";

    /// <summary>Sessions-revoked detail: a Manager set a temporary password.</summary>
    public const string DetailTemporaryPassword = "temporary-password";

    /// <summary>Reset-request detail: the reset email went out.</summary>
    public const string DetailSent = "sent";

    /// <summary>Reset-request detail: the hourly cap was reached, so no email went out.</summary>
    public const string DetailCapped = "capped";

    /// <summary>Password-changed detail: the person changed it in My Profile.</summary>
    public const string DetailProfile = "profile";

    /// <summary>Invitation detail: sent by a Manager.</summary>
    public const string DetailManager = "manager";

    /// <summary>Email-change-canceled detail: the new address was taken first.</summary>
    public const string DetailTaken = "taken";

    /// <summary>Email-change-requested detail: the link was sent again.</summary>
    public const string DetailResent = "resent";

    /// <summary>Breach-check detail: the lookup failed while accepting an invitation.</summary>
    public const string DetailInvite = "invite";

    /// <summary>Invitation detail: sent by the bootstrap command.</summary>
    public const string DetailBootstrap = "bootstrap";

    /// <summary>Why a sign-in failed (the detail of <see cref="SignInFailed"/>).</summary>
    public static IReadOnlyList<string> SignInFailureReasons { get; } =
        [DetailUnknownAccount, DetailBadPassword, DetailLocked, DetailDeactivated, DetailUnconfirmed, DetailNoPassword, DetailManagerLocked, DetailDeleted];

    /// <summary>What triggered a lockout (the detail of <see cref="Lockout"/>).</summary>
    public static IReadOnlyList<string> LockoutDetails { get; } = [DetailPassword, DetailCode];

    /// <summary>Why sessions were revoked (the detail of <see cref="SessionsRevoked"/>).</summary>
    public static IReadOnlyList<string> SessionsRevokedDetails { get; } =
        [DetailSignOutOthers, DetailPasswordReset, DetailPasswordChanged, DetailAccountChanged, DetailTemporaryPassword];

    /// <summary>What happened to a reset request (the detail of <see cref="PasswordResetRequested"/>).</summary>
    public static IReadOnlyList<string> ResetRequestDetails { get; } =
        [DetailUnknownAccount, DetailManagerLocked, DetailCapped, DetailSent, DetailDeactivated];

    /// <summary>
    /// The codes a person can cause without a signed-in token: sign-in, sign-in codes, password reset, invitation acceptance and the
    /// email-confirmation steps. Such an entry has no actor, so the audit viewer reads the person it is about as the one who did it.
    /// </summary>
    public static IReadOnlyList<string> SelfService { get; } =
    [
        SignInFailed,
        Lockout,
        TwoFactorIssued,
        TwoFactorResent,
        TwoFactorVerified,
        TwoFactorFailed,
        TwoFactorExhausted,
        SignedIn,
        RefreshReuseDetected,
        SignedOut,
        SessionsRevoked,
        SessionRevoked,
        PasswordResetRequested,
        PasswordResetCompleted,
        PasswordResetLinkInvalid,
        PasswordChanged,
        PasswordBreachFound,
        BreachCheckUnavailable,
        InviteAccepted,
        ProfileEmailChanged,
        ProfileEmailChangeCanceled,
    ];

    /// <summary>Every action code, in declaration order.</summary>
    public static IReadOnlyList<string> All { get; } =
    [
        SignInFailed,
        Lockout,
        TwoFactorIssued,
        TwoFactorResent,
        TwoFactorVerified,
        TwoFactorFailed,
        TwoFactorExhausted,
        SignedIn,
        RefreshReuseDetected,
        SignedOut,
        SessionsRevoked,
        SessionRevoked,
        PasswordResetRequested,
        PasswordResetCompleted,
        PasswordResetLinkInvalid,
        PasswordChanged,
        PasswordBreachFound,
        BreachCheckUnavailable,
        InviteAccepted,
        BootstrapManagerCreated,
        UserInvited,
        UserCreatedTemporary,
        UserDeactivated,
        UserActivated,
        UserLocked,
        UserUnlocked,
        UserDeleted,
        UserDetailsChanged,
        UserRoleChanged,
        UserEmailChangeStarted,
        UserInvitationResent,
        UserResetLinkSent,
        UserTemporaryPasswordSet,
        ProfileNameChanged,
        ProfileEmailChangeRequested,
        ProfileEmailChanged,
        ProfileEmailChangeCanceled,
        CompanyExpenseAdded,
        CompanyExpenseChanged,
        CompanyExpensePayerChanged,
        CompanyExpenseDeleted,
        CompanyExpenseRestored,
        CompanyExpensePermanentlyDeleted,
        ExpenseCategoryAdded,
        ExpenseCategoryRenamed,
        ExpenseCategoryRecolored,
        ExpenseCategoryRetired,
        ExpenseCategoryReactivated,
        ExpenseCategoryDeleted,
        OrderCreated,
        OrderChanged,
        OrderStatusChanged,
        OrderReopened,
        OrderDeleted,
        OrderRestored,
        OrderPermanentlyDeleted,
        OrderItemAdded,
        OrderItemChanged,
        OrderItemRemoved,
        OrderPaymentAdded,
        OrderPaymentChanged,
        OrderPaymentReceiverChanged,
        OrderPaymentRemoved,
        OrderRefundAdded,
        OrderRefundChanged,
        OrderRefundRefunderChanged,
        OrderRefundRemoved,
        OrderDiscountAdded,
        OrderDiscountChanged,
        OrderDiscountRemoved,
        OrderExpenseAdded,
        OrderExpenseChanged,
        OrderExpensePayerChanged,
        OrderExpenseRemoved,
        ProductTypeAdded,
        ProductTypeRenamed,
        ProductTypeRecolored,
        ProductTypeRetired,
        ProductTypeReactivated,
        ProductTypeDeleted,
        PaymentMethodAdded,
        PaymentMethodRenamed,
        PaymentMethodRecolored,
        PaymentMethodRetired,
        PaymentMethodReactivated,
        PaymentMethodDeleted,
        OrderExpenseCategoryAdded,
        OrderExpenseCategoryRenamed,
        OrderExpenseCategoryRecolored,
        OrderExpenseCategoryRetired,
        OrderExpenseCategoryReactivated,
        OrderExpenseCategoryDeleted,
        OrderImageAdded,
        OrderImageMoved,
        OrderImageCoverChanged,
        OrderImageDescriptionChanged,
        OrderImageDeleted,
        MoneyTransferAdded,
        MoneyTransferDeleted,
        MoneyTransferPermanentlyDeleted,
        MoneyHandedOver,
        SiteSettingsChanged,
        OpeningHoursChanged,
        ShopClosureAdded,
        ShopClosureChanged,
        ShopClosureDeleted,
        ProductLineAdded,
        ProductLineChanged,
        ProductLineMoved,
        ProductLineHidden,
        ProductLineShown,
        ProductLineDeleted,
        ProductTypeLineLinked,
        ProductLinePhotoChanged,
        TestimonialAdded,
        TestimonialChanged,
        TestimonialMoved,
        TestimonialHidden,
        TestimonialShown,
        TestimonialDeleted,
        OrderPublicConsentRecorded,
        OrderPublicConsentRemoved,
        OrderShownOnWebsite,
        OrderTakenOffWebsite,
        OrderPublicDetailsChanged,
        GalleryPhotoAdded,
        GalleryPhotoChanged,
        GalleryPhotoHidden,
        GalleryPhotoShown,
        GalleryPhotoDeleted,
        GalleryItemMoved,
        SharePictureChanged,
    ];
}
