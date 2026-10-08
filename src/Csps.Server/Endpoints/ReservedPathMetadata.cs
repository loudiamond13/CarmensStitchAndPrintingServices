namespace Csps.Server.Endpoints;

/// <summary>
/// Marks a 404 fallback that reserves a server prefix from the SPA shell, D-29. Outside Development the API-doc
/// prefixes <c>/openapi</c> and <c>/scalar</c> carry it, so tests can tell the reservation apart from real docs routes.
/// </summary>
public sealed class ReservedPathMetadata;
