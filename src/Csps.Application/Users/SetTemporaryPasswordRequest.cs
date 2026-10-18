namespace Csps.Application.Users;

/// <summary>
/// The Set Temporary Password form (C-4, 04 D-21): the one-time password a Manager hands to a colleague. It is hashed by the account
/// port and goes nowhere else; no version is sent, because the action acts on the latest state (D-21).
/// </summary>
/// <param name="TemporaryPassword">The temporary password as typed.</param>
public sealed record SetTemporaryPasswordRequest(string? TemporaryPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports the missing field.</summary>
    public static SetTemporaryPasswordRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so a temporary password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SetTemporaryPasswordRequest);
}
