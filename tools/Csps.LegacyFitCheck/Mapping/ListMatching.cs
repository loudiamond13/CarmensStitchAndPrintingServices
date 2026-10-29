using Csps.Domain.OrderLists;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>A list entry that exists only in the trial database, because the legacy list word has no CSPS match (D-06).</summary>
/// <param name="Kind">Which list.</param>
/// <param name="Id">The id the snapshots point at.</param>
/// <param name="Name">The entry name.</param>
internal sealed record TrialListEntry(OrderListKind Kind, Guid Id, string Name);

/// <summary>Why a legacy order type word cannot become a product type.</summary>
internal enum ProductTypeProblem
{
    None,
    Blank,
    TooLong,
}

/// <summary>The outcome of matching one legacy order type word.</summary>
/// <param name="Id">The product type id, or null when the word cannot become one.</param>
/// <param name="TrialOnly">True when the id belongs to a trial-only entry.</param>
/// <param name="Problem">Why there is no id.</param>
internal sealed record ProductTypeMatch(Guid? Id, bool TrialOnly, ProductTypeProblem Problem);

/// <summary>The list matches of one run: which legacy order type words match a CSPS product type, and the trial-only entries for the rest.</summary>
internal sealed class ListMatches
{
    private readonly Dictionary<string, ProductTypeMatch> _productTypes;

    internal ListMatches(Dictionary<string, ProductTypeMatch> productTypes, IReadOnlyList<TrialListEntry> trialEntries)
    {
        _productTypes = productTypes;
        TrialEntries = trialEntries;
    }

    /// <summary>Gets every trial-only entry to seed before the first import.</summary>
    public IReadOnlyList<TrialListEntry> TrialEntries { get; }

    /// <summary>Gets the id of the one payment method every legacy payment gets (the legacy table has no method).</summary>
    public static Guid UnknownPaymentMethodId => ListMatching.UnknownPaymentMethod.Id;

    /// <summary>Finds the match of a legacy order type word.</summary>
    public ProductTypeMatch ForProductType(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return new ProductTypeMatch(null, false, ProductTypeProblem.Blank);
        }

        return _productTypes.TryGetValue(OrderListEntry.Normalize(trimmed), out var match)
            ? match
            : throw new InvalidOperationException("The order type word was not part of the list matching.");
    }
}

/// <summary>Matches the legacy lists against the CSPS lists by name (D-06). A miss is never forced onto a CSPS entry.</summary>
internal static class ListMatching
{
    /// <summary>The one trial-only payment method every legacy payment gets.</summary>
    public static readonly TrialListEntry UnknownPaymentMethod = new(
        OrderListKind.PaymentMethod,
        new Guid("0f5f3a52-6f0c-4e55-9a57-3b1d7c2f8e41"),
        "Unknown (legacy)");

    /// <summary>Matches each legacy order type word (trimmed, case-insensitive) against the CSPS product types; a miss becomes a trial-only entry.</summary>
    public static ListMatches ForProductTypes(IEnumerable<string?> names)
    {
        ArgumentNullException.ThrowIfNull(names);

        var matches = new Dictionary<string, ProductTypeMatch>(StringComparer.Ordinal);
        var trialEntries = new List<TrialListEntry> { UnknownPaymentMethod };
        foreach (var name in names.Select(static name => name?.Trim()).Where(static name => !string.IsNullOrEmpty(name)))
        {
            var key = OrderListEntry.Normalize(name!);
            if (matches.ContainsKey(key))
            {
                continue;
            }

            var (match, entry) = Classify(name!);
            matches[key] = match;
            if (entry is not null)
            {
                trialEntries.Add(entry);
            }
        }

        return new ListMatches(matches, trialEntries);
    }

    private static (ProductTypeMatch Match, TrialListEntry? Entry) Classify(string trimmedName)
    {
        var normalized = OrderListEntry.Normalize(trimmedName);
        var seeded = OrderListSeed.ProductTypes.FirstOrDefault(row => string.Equals(OrderListEntry.Normalize(row.Name), normalized, StringComparison.Ordinal));
        if (seeded is not null)
        {
            return (new ProductTypeMatch(seeded.Id, false, ProductTypeProblem.None), null);
        }

        if (trimmedName.Length > OrderListEntry.NameMaxLength)
        {
            return (new ProductTypeMatch(null, false, ProductTypeProblem.TooLong), null);
        }

        var entry = new TrialListEntry(OrderListKind.ProductType, Guid.NewGuid(), trimmedName);
        return (new ProductTypeMatch(entry.Id, true, ProductTypeProblem.None), entry);
    }
}
