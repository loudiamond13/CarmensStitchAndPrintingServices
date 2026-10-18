using Csps.Application.Auth;
using Csps.Domain.Common;

namespace Csps.Application.Users;

/// <summary>The error values the staff account use cases return.</summary>
public static class UserErrors
{
    /// <summary>The code of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsCode = "bootstrap.manager-exists";

    /// <summary>The plain-English text of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsMessage = "An active Manager already exists, so the first Manager cannot be created.";

    /// <summary>The code of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenCode = "bootstrap.email-taken";

    /// <summary>The plain-English text of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenMessage = "An account with that email already exists.";

    /// <summary>The code of a person who does not exist or was deleted (D-09).</summary>
    public const string NotFoundCode = "users.not-found";

    /// <summary>The plain-English text for a person who does not exist or was deleted.</summary>
    public const string NotFoundMessage = "This user was deleted.";

    /// <summary>The form field that a taken email belongs to.</summary>
    public const string EmailInUseField = "email";

    /// <summary>The plain-English text under the email field when another account already uses the address.</summary>
    public const string EmailInUseMessage = "Another account already uses this email.";

    /// <summary>The form field that says how a changed email applies (D-45).</summary>
    public const string EmailChangeField = "emailChange";

    /// <summary>The plain-English text under the email-change choice when it is missing or unknown.</summary>
    public const string EmailChangeChoiceMessage = "Choose how the email change applies.";

    /// <summary>The code of a change that would leave no active Manager (D-18).</summary>
    public const string LastActiveManagerCode = "users.last-active-manager";

    /// <summary>The plain-English text of a change that would leave no active Manager.</summary>
    public const string LastActiveManagerMessage = "You can't remove the last active Manager.";

    /// <summary>The code of a Manager acting on their own account (D-19).</summary>
    public const string OwnAccountCode = "users.own-account";

    /// <summary>The plain-English text of a Manager acting on their own account.</summary>
    public const string OwnAccountMessage = "You can't do this to your own account.";

    /// <summary>The code of an invitation asked for a person who already has a password (USER-07).</summary>
    public const string AlreadySetUpCode = "users.already-set-up";

    /// <summary>The plain-English text of an invitation asked for a person who already has a password.</summary>
    public const string AlreadySetUpMessage = "This person has already set up their account.";

    /// <summary>The code of an account action asked for a person who is deactivated or locked (D-41 Q5).</summary>
    public const string BlockedCode = "users.blocked";

    /// <summary>The plain-English text of an account action asked for a person who is deactivated or locked.</summary>
    public const string BlockedMessage = "Unlock or activate this person first.";

    /// <summary>The code of a reset link asked for a person who has no password yet (USER-07).</summary>
    public const string NoPasswordCode = "users.no-password";

    /// <summary>The plain-English text of a reset link asked for a person who has no password yet.</summary>
    public const string NoPasswordMessage = "This person hasn't set a password yet. Resend the invitation instead.";

    /// <summary>The code of a reset link refused because the hourly cap of reset emails is reached (D-39).</summary>
    public const string ResetLinkCappedCode = "users.reset-link-capped";

    /// <summary>The plain-English text of a reset link refused because the hourly cap of reset emails is reached.</summary>
    public const string ResetLinkCappedMessage = "Too many reset emails went to this person in the last hour. Try again later.";

    /// <summary>Gets the answer for a bootstrap while an active Manager exists.</summary>
    public static Error ManagerExists { get; } = Error.BusinessRule(ManagerExistsCode, ManagerExistsMessage);

    /// <summary>Gets the answer for a bootstrap with an email that is already in use.</summary>
    public static Error EmailTaken { get; } = Error.BusinessRule(EmailTakenCode, EmailTakenMessage);

    /// <summary>Gets the answer for a person who does not exist or was deleted: a 404 with the same words for both.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the answer for a change that would leave no active Manager: a 422 that changes nothing.</summary>
    public static Error LastActiveManager { get; } = Error.BusinessRule(LastActiveManagerCode, LastActiveManagerMessage);

    /// <summary>Gets the answer for a Manager acting on their own account: a 422 that changes nothing.</summary>
    public static Error OwnAccount { get; } = Error.BusinessRule(OwnAccountCode, OwnAccountMessage);

    /// <summary>Gets the answer for an invitation asked for a person who already has a password: a 422 that changes nothing.</summary>
    public static Error AlreadySetUp { get; } = Error.BusinessRule(AlreadySetUpCode, AlreadySetUpMessage);

    /// <summary>Gets the answer for an account action asked for a deactivated or locked person: a 422 that changes nothing.</summary>
    public static Error Blocked { get; } = Error.BusinessRule(BlockedCode, BlockedMessage);

    /// <summary>Gets the answer for a reset link asked for a person who has no password yet: a 422 that changes nothing.</summary>
    public static Error NoPassword { get; } = Error.BusinessRule(NoPasswordCode, NoPasswordMessage);

    /// <summary>Gets the answer for a reset link refused by the hourly cap shared with forgot-password: a 429 that changes nothing.</summary>
    public static Error ResetLinkCapped { get; } = Error.TooManyRequests(ResetLinkCappedCode, ResetLinkCappedMessage);

    /// <summary>Gets the answer for a changed email with no valid choice of how it applies (D-45): a 400 on the choice field.</summary>
    public static Error EmailChangeChoiceRequired { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [EmailChangeField] = [EmailChangeChoiceMessage] });

    /// <summary>Gets the answer for creating a person whose email another account already uses: a 400 on the email field.</summary>
    public static Error EmailInUse { get; } = Error.Validation(
        AuthErrors.ValidationCode,
        AuthErrors.ValidationMessage,
        new Dictionary<string, string[]> { [EmailInUseField] = [EmailInUseMessage] });
}
