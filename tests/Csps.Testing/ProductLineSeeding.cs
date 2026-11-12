using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;

namespace Csps.Testing;

/// <summary>Puts the product lines back to the six migrated ones for tests, because <see cref="CspsDatabase.ResetAsync"/> never resets them.</summary>
public static class ProductLineSeeding
{
    /// <summary>
    /// Removes every line that is not one of the six, puts the six back to their seeded values (shown, no price, no minimum) and keeps
    /// their order. Call it after <see cref="CspsDatabase.ResetAsync"/>, which already cleared the photos and the product type links.
    /// </summary>
    /// <param name="database">The test database.</param>
    /// <returns>A task that completes when the lines are back.</returns>
    public static async Task RestoreSixAsync(CspsDatabase database)
    {
        ArgumentNullException.ThrowIfNull(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var lines = await context.ProductLines.ToListAsync().ConfigureAwait(false);
            var seeded = ProductLineSeed.All.ToDictionary(entry => entry.Id);
            context.ProductLines.RemoveRange(lines.Where(line => !seeded.ContainsKey(line.Id)));
            foreach (var line in lines.Where(line => seeded.ContainsKey(line.Id)))
            {
                line.ResetToSeed(seeded[line.Id], null, null);
            }

            await context.SaveChangesAsync().ConfigureAwait(false);
        }
    }
}
