namespace Csps.Application.Ports;

/// <summary>
/// The signed-in user at this moment, for the attribution stamp (SEC-08). Unlike <see cref="IRequestContext"/> it is safe
/// to use from a singleton: an implementation reads the current request on every call and never caches it.
/// </summary>
public interface ICurrentActor
{
    /// <summary>Gets the signed-in user's id from the access token's <c>sub</c> claim, or <see langword="null"/> when there is none (System).</summary>
    Guid? UserId { get; }
}
