namespace Csps.Application.Ports;

/// <summary>Failure codes of the image storage that a caller acts on. The storage port has no status for them, so they travel as codes.</summary>
public static class ImageFailureCodes
{
    /// <summary>The storage did not accept the keys. Trying again will not help until the settings are fixed.</summary>
    public const string Unauthorized = "unauthorized";
}
