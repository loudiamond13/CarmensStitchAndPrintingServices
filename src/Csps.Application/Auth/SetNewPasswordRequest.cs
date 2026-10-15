namespace Csps.Application.Auth;

/// <summary>The must-change form: the new password the person chose after the emailed code (D-13).</summary>
/// <param name="NewPassword">The new password as typed.</param>
public sealed record SetNewPasswordRequest(string? NewPassword)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static SetNewPasswordRequest Empty { get; } = new((string?)null);

    /// <summary>Returns the type name only, so a password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SetNewPasswordRequest);
}
