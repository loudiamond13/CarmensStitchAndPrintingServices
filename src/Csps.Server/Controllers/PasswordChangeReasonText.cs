using Csps.Domain.Identity;

namespace Csps.Server.Controllers;

/// <summary>The wire text of why a new password is needed.</summary>
internal static class PasswordChangeReasonText
{
    /// <summary>Maps a reason to its text.</summary>
    /// <param name="reason">The reason; null when none applies.</param>
    /// <returns><c>temporary</c> or <c>breach</c>; null for none.</returns>
    public static string? For(PasswordChangeReason? reason) => reason switch
    {
        PasswordChangeReason.Temporary => "temporary",
        PasswordChangeReason.Breach => "breach",
        _ => null,
    };
}
