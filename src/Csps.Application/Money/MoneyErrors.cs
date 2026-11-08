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

    /// <summary>The plain-English text for a hand-over with no former staff member chosen (D-58, server only).</summary>
    public const string FromRequiredMessage = "Choose whose money to hand over.";

    /// <summary>The code of a Manager asking about a person who does not exist or is not staff (MONEY-03).</summary>
    public const string PersonNotFoundCode = "staff-money.person-not-found";

    /// <summary>The plain-English text for a Manager asking about a person who does not exist or is not staff (MONEY-03).</summary>
    public const string PersonNotFoundMessage = "This person wasn't found.";

    /// <summary>The code of an Admin asking for someone else's money.</summary>
    public const string ForbiddenCode = "staff-money.forbidden";

    /// <summary>The plain-English text for an Admin asking for someone else's money.</summary>
    public const string ForbiddenMessage = "You can only see your own money.";

    /// <summary>The code of a ledger query with a page or page size out of range.</summary>
    public const string LedgerInvalidCode = "staff-money.invalid-request";

    /// <summary>The code of an Admin asking for deleted transfers (D-31).</summary>
    public const string DeletedForbiddenCode = "staff-money.deleted-forbidden";

    /// <summary>The plain-English text for an Admin asking for deleted transfers (D-31).</summary>
    public const string DeletedForbiddenMessage = "Only Managers can see deleted transfers.";

    /// <summary>The code of a change that lost a race with another change.</summary>
    public const string BusyCode = "money-transfers.busy";

    /// <summary>The plain-English text for a change that lost a race.</summary>
    public const string BusyMessage = AuthErrors.SessionBusyMessage;

    /// <summary>Gets the 404 for a person who does not exist or is not staff.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the 404 for a Manager asking about a person who does not exist, is the legacy holder or is not staff (MONEY-03).</summary>
    public static Error PersonNotFound { get; } = Error.NotFound(PersonNotFoundCode, PersonNotFoundMessage);

    /// <summary>Gets the 403 for an Admin asking for someone else's money, decided before any lookup (CWE-639, CWE-204).</summary>
    public static Error Forbidden { get; } = Error.Forbidden(ForbiddenCode, ForbiddenMessage);

    /// <summary>Gets the 403 for an Admin who asks to see deleted transfers (D-31).</summary>
    public static Error DeletedForbidden { get; } = Error.Forbidden(DeletedForbiddenCode, DeletedForbiddenMessage);

    /// <summary>Gets the 409 for a change that lost a race with another change.</summary>
    public static Error Busy { get; } = Error.Conflict(BusyCode, BusyMessage);
}
