namespace Csps.Domain.Content;

/// <summary>
/// Marks a record whose saved change shows on the public site. The data layer clears the public cache after any
/// committed save that added, changed or removed one (PUB-03, CONT-05).
/// </summary>
public interface IPublicContentRecord
{
}
