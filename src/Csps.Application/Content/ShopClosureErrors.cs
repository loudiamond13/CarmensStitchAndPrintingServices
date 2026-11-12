using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>The error values the closure use cases return (CONT-04).</summary>
public static class ShopClosureErrors
{
    /// <summary>The machine code of a closure that does not exist.</summary>
    public const string NotFoundCode = "shop-closures.not-found";

    /// <summary>The plain-English text for a closure that does not exist.</summary>
    public const string NotFoundMessage = "This closure wasn't found.";

    /// <summary>Gets the 404 for a closure that does not exist.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);
}
