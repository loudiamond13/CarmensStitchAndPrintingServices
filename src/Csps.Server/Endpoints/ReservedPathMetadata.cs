namespace Csps.Server.Endpoints;

/// <summary>
/// Marks the D-29 reserved-prefix 404 fallbacks so DocsRoutes ignores them. Outside Development the API-doc prefixes
/// <c>/openapi</c> and <c>/scalar</c> carry it, so tests can tell the reservation apart from real docs routes.
/// </summary>
public sealed class ReservedPathMetadata;
