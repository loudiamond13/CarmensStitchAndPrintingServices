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
    ];
}
