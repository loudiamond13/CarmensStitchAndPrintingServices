using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>Checks a page view (ANL-05, the server half of OR-3): the path is sent, starts with a slash and is at most 2,048 characters before it is cut.</summary>
public sealed class PageViewRequestValidator : AbstractValidator<PageViewRequest>
{
    /// <summary>The message for a missing path.</summary>
    public const string PathRequired = "The page path is missing.";

    /// <summary>The message for a path that does not start with a slash.</summary>
    public const string PathInvalid = "The page path must start with a slash.";

    /// <summary>The message for a path that is too long.</summary>
    public const string PathTooLong = "The page path is too long.";
}
