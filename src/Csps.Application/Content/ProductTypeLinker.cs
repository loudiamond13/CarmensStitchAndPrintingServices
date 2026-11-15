using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Domain.OrderLists;

namespace Csps.Application.Content;

/// <summary>
/// Files order product types under a product line when a Manager saves the line (D-09). The ticked types are filed under the line, moving
/// from another line when they were under one, and the types that were under the line and are no longer ticked are freed. Each move,
/// filing or freeing writes a <c>product-type.line-linked</c> entry with the old and new line titles.
/// </summary>
internal static class ProductTypeLinker
{
    /// <summary>Reads the ticked types before anything changes, so a type that no longer exists refuses the whole save.</summary>
    /// <param name="lines">The product line store.</param>
    /// <param name="ticked">The ticked ids, as sent.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The tracked types, or null when an id matches no product type.</returns>
    public static async Task<IReadOnlyList<ProductType>?> FindTickedAsync(IProductLines lines, IReadOnlyList<Guid> ticked, CancellationToken cancellationToken)
    {
        var wanted = ticked.Distinct().ToList();
        var found = await lines.FindTypesAsync(wanted, cancellationToken).ConfigureAwait(false);
        return found.Count == wanted.Count ? found : null;
    }

    /// <summary>Files the ticked types under the line and frees the others that were under it.</summary>
    /// <param name="lines">The product line store.</param>
    /// <param name="audit">The audit trail.</param>
    /// <param name="line">The line, with its saved or new title.</param>
    /// <param name="ticked">The tracked ticked types.</param>
    /// <param name="alreadyFiled">The tracked types that were under the line before; none for a new line.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>How many types changed.</returns>
    public static async Task<int> ApplyAsync(
        IProductLines lines,
        IAuditTrail audit,
        ProductLine line,
        IReadOnlyList<ProductType> ticked,
        IReadOnlyList<ProductType> alreadyFiled,
        CancellationToken cancellationToken)
    {
        var tickedIds = ticked.Select(type => type.Id).ToHashSet();
        var toFile = ticked.Where(type => type.ProductLineId != line.Id).ToList();
        var toFree = alreadyFiled.Where(type => !tickedIds.Contains(type.Id)).ToList();

        var otherLines = toFile.Select(type => type.ProductLineId).OfType<Guid>().Distinct().ToList();
        var titles = otherLines.Count == 0
            ? new Dictionary<Guid, string>()
            : (await lines.GetTitlesAsync(otherLines, cancellationToken).ConfigureAwait(false)).ToDictionary(pair => pair.Key, pair => pair.Value);

        foreach (var type in toFile)
        {
            var before = type.ProductLineId is { } other ? titles.GetValueOrDefault(other) : null;
            type.LinkToLine(line.Id);
            audit.Record(AuditActions.ProductTypeLineLinked, ProductLineAuditDetail.LinkTargetType, AuditKey.Of(type.Id), ProductLineAuditDetail.Linked(before, line.Title));
        }

        foreach (var type in toFree)
        {
            type.LinkToLine(null);
            audit.Record(AuditActions.ProductTypeLineLinked, ProductLineAuditDetail.LinkTargetType, AuditKey.Of(type.Id), ProductLineAuditDetail.Linked(line.Title, null));
        }

        return toFile.Count + toFree.Count;
    }
}
