using Csps.Application.Ports;

namespace Csps.Server.Http;

/// <summary>
/// <see cref="ICurrentActor"/> read from the current <see cref="HttpContext"/> on every call (the accessor is per request),
/// so the singleton never carries one request's user into another. The id is the raw <c>sub</c> claim, the same source
/// as <see cref="HttpRequestContext"/>. Registered as a singleton because the context factory is built from the root provider.
/// </summary>
/// <param name="accessor">Gives access to the current request, if any.</param>
public sealed class HttpCurrentActor(IHttpContextAccessor accessor) : ICurrentActor
{
    private const string SubjectClaimType = "sub";

    /// <inheritdoc />
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirst(SubjectClaimType)?.Value, out var userId) ? userId : null;
}
