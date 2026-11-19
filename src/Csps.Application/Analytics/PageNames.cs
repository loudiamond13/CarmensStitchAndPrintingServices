using Csps.Domain.Analytics;

namespace Csps.Application.Analytics;

/// <summary>
/// The English name of each page key and the fixed order pages are listed in (D-69, D-75). The CSV export shows these names. The web app keeps
/// the same list in its copy file, and one shared test file checks that both agree.
/// </summary>
public static class PageNames
{
    /// <summary>The known pages as (key, name), in route order and then the not-found page.</summary>
    public static IReadOnlyList<(string Key, string Name)> Ordered { get; } =
    [
        (PageKeys.Home, "Home"),
        (PageKeys.Products, "Products"),
        (PageKeys.Gallery, "Gallery"),
        (PageKeys.Contact, "Contact"),
        (PageKeys.Privacy, "Privacy Policy"),
        (PageKeys.Terms, "Terms of Use"),
        (PageKeys.Accessibility, "Accessibility Statement"),
        (PageKeys.NotFound, "Page not found"),
    ];

    /// <summary>Gets the name of a page key.</summary>
    /// <param name="key">The stored page key.</param>
    /// <returns>The page's name, or the key itself for an old key that has no name.</returns>
    public static string NameFor(string key)
    {
        ArgumentNullException.ThrowIfNull(key);

        foreach (var (known, name) in Ordered)
        {
            if (string.Equals(known, key, StringComparison.Ordinal))
            {
                return name;
            }
        }

        return key;
    }

    /// <summary>Gets where a page key sits in the fixed order.</summary>
    /// <param name="key">The stored page key.</param>
    /// <returns>The place of a known key, or the count of known pages for any other key, so unknown keys sort last.</returns>
    public static int OrderOf(string key)
    {
        ArgumentNullException.ThrowIfNull(key);

        for (var index = 0; index < Ordered.Count; index++)
        {
            if (string.Equals(Ordered[index].Key, key, StringComparison.Ordinal))
            {
                return index;
            }
        }

        return Ordered.Count;
    }
}
