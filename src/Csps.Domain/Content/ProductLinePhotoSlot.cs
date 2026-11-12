namespace Csps.Domain.Content;

/// <summary>The fixed place of a product line photo (D-02): a line has at most one photo in each slot.</summary>
public enum ProductLinePhotoSlot
{
    /// <summary>The large main photo.</summary>
    Main = 0,

    /// <summary>The back view.</summary>
    Back = 1,

    /// <summary>The fabric detail.</summary>
    Fabric = 2,
}
