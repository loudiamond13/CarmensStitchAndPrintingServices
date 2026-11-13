using Csps.Domain.Content;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Microsoft.EntityFrameworkCore;

namespace Csps.Testing;

/// <summary>
/// One order to write for the public gallery tests. Every customer value is made up and distinctive, so a leak into a public answer is
/// found by searching for it. The order is Pending, because a photo cannot be added to a locked one.
/// </summary>
/// <param name="Team">The team name on the order.</param>
public sealed record SeedGalleryOrder(string Team)
{
    /// <summary>The distinctive customer name every seeded order carries.</summary>
    public const string PrivateCustomerName = "PRIVATE-NAME-1";

    /// <summary>The distinctive phone number every seeded order carries.</summary>
    public const string PrivatePhone = "0917 999 0001";

    /// <summary>The distinctive email every seeded order carries.</summary>
    public const string PrivateEmail = "private1@csps.test";

    /// <summary>The distinctive address every seeded order carries.</summary>
    public const string PrivateAddress = "PRIVATE-ADDRESS-1";

    /// <summary>The distinctive note every seeded order carries.</summary>
    public const string PrivateNotes = "PRIVATE-NOTES-1";

    /// <summary>The distinctive item description every seeded order carries.</summary>
    public const string PrivateItemDescription = "PRIVATE-ITEM-DESCRIPTION";

    /// <summary>The distinctive photo description every seeded photo carries.</summary>
    public const string PrivatePhotoDescription = "PRIVATE-DESCRIPTION";

    /// <summary>The unit price of the one item of every seeded order.</summary>
    public const decimal PrivateUnitPrice = 1234.56m;

    /// <summary>Gets the name shown instead of the team; null shows the team.</summary>
    public string? PublicName { get; init; }

    /// <summary>Gets the key of the line the order's product type is filed under: <c>basketball</c>, <c>volleyball</c>, <c>moto</c>, <c>longsleeves</c> or <c>polo</c>.</summary>
    public string LineKey { get; init; } = "basketball";

    /// <summary>Gets a value indicating whether the order's product type is filed under no line.</summary>
    public bool Unfiled { get; init; }

    /// <summary>Gets the key of the line staff chose, which overrides the auto line; null for none.</summary>
    public string? LineOverrideKey { get; init; }

    /// <summary>Gets the pieces: the quantity of the one item.</summary>
    public int Pieces { get; init; } = 10;

    /// <summary>Gets the photos, cover first, as width and height.</summary>
    public IReadOnlyList<(int Width, int Height)> Photos { get; init; } = [(800, 600)];

    /// <summary>Gets a value indicating whether the customer's OK is recorded.</summary>
    public bool Consent { get; init; } = true;

    /// <summary>Gets a value indicating whether the order is shown on the website (its shown date is set).</summary>
    public bool Show { get; init; } = true;

    /// <summary>Gets a value indicating whether the gallery entry is written even when the order is not shown, to prove the read does not trust the entry alone.</summary>
    public bool ForceEntry { get; init; }

    /// <summary>Gets a value indicating whether the order is soft-deleted after it is written.</summary>
    public bool Deleted { get; init; }

    /// <summary>Gets the instant the order was put on the website; null uses the seeding instant.</summary>
    public DateTimeOffset? ShownAtUtc { get; init; }

    /// <summary>Gets the place in the gallery order; null uses the order's place in the list.</summary>
    public int? Position { get; init; }
}

/// <summary>One direct upload to write for the public gallery tests.</summary>
/// <param name="Team">The team or name shown.</param>
/// <param name="LineKey">The key of the line it is filed under.</param>
public sealed record SeedGalleryUpload(string Team, string LineKey)
{
    /// <summary>Gets the pieces; null for none.</summary>
    public int? Pieces { get; init; }

    /// <summary>Gets the note; null for none.</summary>
    public string? Note { get; init; }

    /// <summary>Gets a value indicating whether the upload shows on the website.</summary>
    public bool Shown { get; init; } = true;

    /// <summary>Gets the photo's width in pixels.</summary>
    public int Width { get; init; } = 800;

    /// <summary>Gets the photo's height in pixels.</summary>
    public int Height { get; init; } = 600;

    /// <summary>Gets the place in the gallery order.</summary>
    public int Position { get; init; }
}

/// <summary>Writes orders and uploads for the public gallery tests straight to a test database, with plain contexts (no cache interceptors).</summary>
public static class GallerySeeding
{
    private static readonly string[] LineKeys = ["basketball", "volleyball", "moto", "longsleeves", "polo"];

    private static int _numberCounter;

    /// <summary>Files the first five product types under the first five lines, so an order of one of them has an auto line. The sixth stays unfiled.</summary>
    /// <param name="database">The test database.</param>
    /// <returns>A task that completes when the links are saved.</returns>
    public static async Task LinkProductTypesAsync(CspsDatabase database)
    {
        ArgumentNullException.ThrowIfNull(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var types = await context.ProductTypes.ToListAsync().ConfigureAwait(false);
            for (var index = 0; index < LineKeys.Length; index++)
            {
                types.Single(type => type.Id == OrderListSeed.ProductTypes[index].Id).LinkToLine(LineId(LineKeys[index]));
            }

            await context.SaveChangesAsync().ConfigureAwait(false);
        }
    }

    /// <summary>Gets the id of a seeded line.</summary>
    /// <param name="key">The line key.</param>
    /// <returns>The id.</returns>
    public static Guid LineId(string key) => ProductLineSeed.All.Single(entry => entry.Key == key).Id;

    /// <summary>Writes the orders with their photos, public settings and gallery entries in one save.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="specs">The orders, top of the gallery first.</param>
    /// <param name="staffId">A staff member, recorded as who noted the customer's OK.</param>
    /// <param name="now">The instant everything is written at.</param>
    /// <returns>The order ids, in the order given.</returns>
    public static async Task<IReadOnlyList<Guid>> AddOrdersAsync(CspsDatabase database, IReadOnlyList<SeedGalleryOrder> specs, Guid staffId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(specs);
        List<Guid> ids = [];
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            for (var index = 0; index < specs.Count; index++)
            {
                var spec = specs[index];
                var typeIndex = spec.Unfiled ? OrderListSeed.ProductTypes.Count - 1 : Array.IndexOf(LineKeys, spec.LineKey);
                var item = new NewOrderItem(OrderListSeed.ProductTypes[typeIndex].Id, SeedGalleryOrder.PrivateItemDescription, null, spec.Pieces, SeedGalleryOrder.PrivateUnitPrice);
                var details = new OrderDetails(
                    SeedGalleryOrder.PrivateCustomerName,
                    spec.Team,
                    SeedGalleryOrder.PrivatePhone,
                    SeedGalleryOrder.PrivateEmail,
                    SeedGalleryOrder.PrivateAddress,
                    new DateOnly(2026, 10, 1),
                    null,
                    SeedGalleryOrder.PrivateNotes);
                var number = $"ORD-2026-{Interlocked.Increment(ref _numberCounter):D4}";
                var order = Order.Import(new OrderImportSnapshot(number, details, OrderStatus.Pending, [item]), OrderImportRules.Default, now).Value;
                foreach (var (width, height) in spec.Photos)
                {
                    var publicId = $"csps/orders/{Guid.NewGuid():N}/{Guid.NewGuid():N}";
                    Require(order.AddImage(new NewOrderImage(publicId, width, height, 1000, "jpg", SeedGalleryOrder.PrivatePhotoDescription), now).IsSuccess, "The seeded photo was refused.");
                }

                // The domain refuses to show an order with no line, so the shown date is set below on the entity and the save goes through
                // the domain only for the OK, the line choice and the name.
                var autoLine = spec.Unfiled ? (Guid?)null : LineId(spec.LineKey);
                var overrideLine = spec.LineOverrideKey is null ? autoLine : LineId(spec.LineOverrideKey);
                Require(order.SetPublicSettings(new OrderPublicSettings(spec.Consent, ShowOnWebsite: false, overrideLine, spec.PublicName), staffId, autoLine, now).IsSuccess, "The seeded public settings were refused.");
                if (spec.Deleted)
                {
                    Require(order.SoftDelete(staffId, now), "The seeded order could not be deleted.");
                }

                context.Orders.Add(order);
                if (spec.Show)
                {
                    context.Entry(order).Property(row => row.ShownOnWebsiteSinceUtc).CurrentValue = spec.ShownAtUtc ?? now;
                }

                if (spec.Show || spec.ForceEntry)
                {
                    context.GalleryEntries.Add(GalleryEntry.ForOrder(order.Id, spec.Position ?? index, now));
                }

                ids.Add(order.Id);
            }

            await context.SaveChangesAsync().ConfigureAwait(false);
        }

        return ids;
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }

    /// <summary>Writes one direct upload entry through the domain's own factory.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="spec">The upload.</param>
    /// <param name="now">The instant it is written at.</param>
    /// <returns>The entry id.</returns>
    public static async Task<Guid> AddUploadAsync(CspsDatabase database, SeedGalleryUpload spec, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(spec);
        var id = GalleryEntry.NewId(now);
        var file = new LinePhotoFile($"csps/content/gallery/{id:D}/{Guid.NewGuid():N}", spec.Width, spec.Height, 1000, "jpg");
        var values = new GalleryUploadValues(spec.Team, LineId(spec.LineKey), spec.Pieces, spec.Note, spec.Shown);
        var created = GalleryEntry.CreateUpload(id, values, file, spec.Position, now);
        Require(created.IsSuccess, "The seeded upload was refused.");
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            context.GalleryEntries.Add(created.Value);
            await context.SaveChangesAsync().ConfigureAwait(false);
        }

        return id;
    }
}
