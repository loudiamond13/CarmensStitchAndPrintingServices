namespace Csps.Application.Users;

/// <summary>The answer to creating a person. It holds the id only: never a name, an email or a password (D-14).</summary>
/// <param name="Id">The new account id.</param>
public sealed record CreateUserResponse(Guid Id);
