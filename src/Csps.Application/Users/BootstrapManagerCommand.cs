namespace Csps.Application.Users;

/// <summary>The details of the first Manager (D-29). The account gets no password: an emailed invite sets it.</summary>
/// <param name="Email">The sign-in email.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
public sealed record BootstrapManagerCommand(string? Email, string? FirstName, string? LastName)
{
    /// <summary>Returns the type name only, so an address never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(BootstrapManagerCommand);
}
