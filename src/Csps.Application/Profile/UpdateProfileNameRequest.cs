namespace Csps.Application.Profile;

/// <summary>The profile name form: the names and the edit version the form was opened with (SEC-07).</summary>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Version">The edit version as a GUID in <c>D</c> form.</param>
public sealed record UpdateProfileNameRequest(string? FirstName, string? LastName, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static UpdateProfileNameRequest Empty { get; } = new(null, null, null);
}
