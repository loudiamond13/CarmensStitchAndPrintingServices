namespace Csps.Domain.Identity;

/// <summary>The account details a password must not contain (D-15).</summary>
/// <param name="Email">The account email; its part before the last '@' is checked.</param>
/// <param name="FirstName">The first name, if known.</param>
/// <param name="LastName">The last name, if known.</param>
public sealed record PersonalInfo(string Email, string? FirstName, string? LastName);
