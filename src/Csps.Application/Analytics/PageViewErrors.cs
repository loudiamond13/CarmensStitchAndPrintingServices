namespace Csps.Application.Analytics;

/// <summary>The error text the page view use case returns (ANL-05).</summary>
public static class PageViewErrors
{
    /// <summary>The code of a request with a missing or malformed path.</summary>
    public const string ValidationCode = "analytics.invalid-page-view";

    /// <summary>The text above the field errors of a bad request.</summary>
    public const string ValidationMessage = "Check the page path.";
}
