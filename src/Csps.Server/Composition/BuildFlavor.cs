namespace Csps.Server.Composition;

/// <summary>Tells which build this is, so tests include the Testing-only routes only where they exist (QUAL-05).</summary>
public static class BuildFlavor
{
    /// <summary>Gets a value indicating whether this is a Debug build, which carries the Testing-only features.</summary>
    public static bool HasTestingFeatures
    {
        get
        {
#if CSPS_TESTING
            return true;
#else
            return false;
#endif
        }
    }
}
