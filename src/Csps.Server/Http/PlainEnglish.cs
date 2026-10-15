namespace Csps.Server.Http;

/// <summary>
/// Short, plain-English ProblemDetails titles (D-26). They describe the situation, never blame the user,
/// and never contain technical terms.
/// </summary>
public static class PlainEnglish
{
    /// <summary>The title of every server error (D-27).</summary>
    public const string ServerErrorTitle = "Something went wrong.";

    /// <summary>Returns the title for an HTTP status code.</summary>
    /// <param name="status">The HTTP status code.</param>
    /// <returns>The plain-English title.</returns>
    public static string TitleFor(int status) => status switch
    {
        StatusCodes.Status400BadRequest => "Some details need fixing.",
        StatusCodes.Status401Unauthorized => "Please sign in to continue.",
        StatusCodes.Status403Forbidden => "You don't have access to this.",
        StatusCodes.Status404NotFound => "We couldn't find that.",
        StatusCodes.Status405MethodNotAllowed => "That action isn't available here.",
        StatusCodes.Status409Conflict => "This was changed by someone else.",
        StatusCodes.Status413PayloadTooLarge => "The request is too large.",
        StatusCodes.Status415UnsupportedMediaType => "That format isn't supported.",
        StatusCodes.Status422UnprocessableEntity => "That can't be done.",
        StatusCodes.Status429TooManyRequests => "Too many requests. Please wait a moment and try again.",
        StatusCodes.Status503ServiceUnavailable => "The service is busy. Please try again shortly.",
        >= 400 and < 500 => "That request couldn't be completed.",
        _ => ServerErrorTitle,
    };
}
