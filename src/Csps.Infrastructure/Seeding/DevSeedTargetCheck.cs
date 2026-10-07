namespace Csps.Infrastructure.Seeding;

/// <summary>The verdict of <see cref="DevSeedTargetGuard.Check"/>.</summary>
/// <param name="Allowed">True only for <c>CSPS_Dev</c> or <c>CSPS_E2E</c> on an allowed server.</param>
/// <param name="DatabaseName">The database the connection string names, when it could be read.</param>
/// <param name="Reason">Plain-English explanation; never contains the connection string itself.</param>
public sealed record DevSeedTargetCheck(bool Allowed, string? DatabaseName, string Reason);
