namespace Csps.Domain.Analytics;

/// <summary>The page key stored for each public page.</summary>
public static class PageKeys
{
    /// <summary>The longest page key.</summary>
    public const int MaxLength = 32;

    /// <summary>The home page.</summary>
    public const string Home = "";

    /// <summary>The products page.</summary>
    public const string Products = "";

    /// <summary>The gallery page.</summary>
    public const string Gallery = "";

    /// <summary>The contact page.</summary>
    public const string Contact = "";

    /// <summary>The privacy policy.</summary>
    public const string Privacy = "";

    /// <summary>The cookie policy.</summary>
    public const string Cookies = "";

    /// <summary>The terms page.</summary>
    public const string Terms = "";

    /// <summary>The accessibility statement.</summary>
    public const string Accessibility = "";

    /// <summary>A path that is not a known page.</summary>
    public const string NotFound = "";
}
