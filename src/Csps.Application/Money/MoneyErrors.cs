using Csps.Application.Auth;
using Csps.Domain.Common;

namespace Csps.Application.Money;

/// <summary>The error values the staff money use cases return.</summary>
public static class MoneyErrors
{
    /// <summary>The code of a person who does not exist or is not staff.</summary>
    public const string NotFoundCode = "staff-money.not-found";

    /// <summary>The plain-English text for a person who does not exist or is not staff.</summary>
    public const string NotFoundMessage = "This person was not found.";

    /// <summary>The plain-English text for a recipient who does not exist or is not staff (D-58).</summary>
    public const string UnknownRecipientMessage = "This person can't receive transfers now. Choose someone else.";

    /// <summary>The code of a call the signed-in role may not make.</summary>
    public const string ForbiddenCode = "staff-money.forbidden";

    /// <summary>The plain-English text for a call the signed-in role may not make.</summary>
    public const string ForbiddenMessage = "You can't do this.";

    /// <summary>The code of a change that lost a race with another change.</summary>
    public const string BusyCode = "money-transfers.busy";

    /// <summary>The plain-English text for a change that lost a race.</summary>
    public const string BusyMessage = AuthErrors.SessionBusyMessage;

    /// <summary>Gets the 404 for a person who does not exist or is not staff.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the 403 for a call the signed-in role may not make.</summary>
    public static Error Forbidden { get; } = Error.Forbidden(ForbiddenCode, ForbiddenMessage);

    /// <summary>Gets the 409 for a change that lost a race with another change.</summary>
    public static Error Busy { get; } = Error.Conflict(BusyCode, BusyMessage);
}
