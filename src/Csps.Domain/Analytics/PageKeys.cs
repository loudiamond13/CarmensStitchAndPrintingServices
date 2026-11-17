namespace Csps.Domain.Analytics;

/// <summary>The page key stored for each public page. Only these names ever reach the page counts.</summary>
public static class PageKeys
{
    /// <summary>The longest page key.</summary>
    public const int MaxLength = 32;

    /// <summary>The home page.</summary>
    public const string Home = "home";

    /// <summary>The products page.</summary>
    public const string Products = "products";

    /// <summary>The gallery page.</summary>
    public const string Gallery = "gallery";

    /// <summary>The contact page.</summary>
    public const string Contact = "contact";

    /// <summary>The privacy policy.</summary>
    public const string Privacy = "privacy";

    /// <summary>The cookie policy.</summary>
    public const string Cookies = "cookies";

    /// <summary>The terms page.</summary>
    public const string Terms = "terms";

    /// <summary>The accessibility statement.</summary>
    public const string Accessibility = "accessibility";

    /// <summary>A path that is not a known page.</summary>
    public const string NotFound = "not-found";
}
