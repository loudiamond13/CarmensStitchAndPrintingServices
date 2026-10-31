using System.Globalization;
using FluentValidation;

namespace Csps.Application.Common;

/// <summary>The caps every list endpoint shares (SEC-03).</summary>
public static class ListQueryLimits
{
    /// <summary>The largest page a list may ask for.</summary>
    public const int MaxPageSize = 100;

    /// <summary>The longest free-text search, in UTF-16 code units (what the browser's string length counts).</summary>
    public const int MaxSearchLength = 100;
}

/// <summary>FluentValidation rules for the page size and search text of list queries (SEC-03).</summary>
public static class ListQueryRules
{
    private static readonly string PageSizeMessage = string.Create(CultureInfo.InvariantCulture, $"Use a page size from 1 to {ListQueryLimits.MaxPageSize}.");
    private static readonly string SearchMessage = string.Create(CultureInfo.InvariantCulture, $"Use {ListQueryLimits.MaxSearchLength} characters or fewer.");

    /// <summary>The page size must be from 1 to <see cref="ListQueryLimits.MaxPageSize"/>.</summary>
    /// <typeparam name="T">The validated type.</typeparam>
    /// <param name="rule">The rule builder.</param>
    /// <returns>The rule builder for chaining.</returns>
    public static IRuleBuilderOptions<T, int> PageSize<T>(this IRuleBuilder<T, int> rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return rule.InclusiveBetween(1, ListQueryLimits.MaxPageSize).WithMessage(PageSizeMessage);
    }

    /// <summary>The search text may be at most <see cref="ListQueryLimits.MaxSearchLength"/> UTF-16 code units.</summary>
    /// <typeparam name="T">The validated type.</typeparam>
    /// <param name="rule">The rule builder.</param>
    /// <returns>The rule builder for chaining.</returns>
    public static IRuleBuilderOptions<T, string?> SearchText<T>(this IRuleBuilder<T, string?> rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return rule.MaximumLength(ListQueryLimits.MaxSearchLength).WithMessage(SearchMessage);
    }
}
