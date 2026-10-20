using Csps.Domain.Common;

namespace Csps.Application.Common;

/// <summary>The error every edit form shares when its save is made from an out-of-date copy (SEC-07, D-20).</summary>
public static class EditErrors
{
    /// <summary>The machine code of a save made from an out-of-date copy.</summary>
    public const string StaleCode = "edit.stale";

    /// <summary>The plain-English text of a save made from an out-of-date copy.</summary>
    public const string StaleMessage = "This was changed by someone else. Reload and try again.";

    /// <summary>Gets the 409 for a save whose version is not the stored one.</summary>
    public static Error Stale { get; } = Error.Conflict(StaleCode, StaleMessage);
}
