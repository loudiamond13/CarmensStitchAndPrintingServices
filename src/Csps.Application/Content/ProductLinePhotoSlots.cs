using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>The words the routes, the answers and the audit trail use for the three photo slots of a product line (D-02).</summary>
public static class ProductLinePhotoSlots
{
    /// <summary>The word for the main photo.</summary>
    public const string Main = "main";

    /// <summary>The word for the back view.</summary>
    public const string Back = "back";

    /// <summary>The word for the fabric detail.</summary>
    public const string Fabric = "fabric";

    /// <summary>Reads the word of a slot.</summary>
    /// <param name="text">The route value; letter case is ignored.</param>
    /// <param name="slot">The slot when the word names one.</param>
    /// <returns>True when the word names a slot.</returns>
    public static bool TryParse(string? text, out ProductLinePhotoSlot slot)
    {
        if (string.Equals(text, Main, StringComparison.OrdinalIgnoreCase))
        {
            slot = ProductLinePhotoSlot.Main;
            return true;
        }

        if (string.Equals(text, Back, StringComparison.OrdinalIgnoreCase))
        {
            slot = ProductLinePhotoSlot.Back;
            return true;
        }

        if (string.Equals(text, Fabric, StringComparison.OrdinalIgnoreCase))
        {
            slot = ProductLinePhotoSlot.Fabric;
            return true;
        }

        slot = default;
        return false;
    }

    /// <summary>Gives the word of a slot.</summary>
    /// <param name="slot">The slot.</param>
    /// <returns>The word.</returns>
    public static string ToText(ProductLinePhotoSlot slot) => slot switch
    {
        ProductLinePhotoSlot.Main => Main,
        ProductLinePhotoSlot.Back => Back,
        ProductLinePhotoSlot.Fabric => Fabric,
        _ => throw new ArgumentOutOfRangeException(nameof(slot), slot, "Not a product line photo slot."),
    };
}
