namespace Csps.Domain.Analytics;

/// <summary>The fixed source names and the length limit of the source column that the kept analytics tables read (D-28, D-56).</summary>
public static class ReferrerName
{
    /// <summary>Facebook, including its mobile and link-shim hosts.</summary>
    public const string Facebook = "Facebook";

    /// <summary>Messenger.</summary>
    public const string Messenger = "Messenger";

    /// <summary>Instagram.</summary>
    public const string Instagram = "Instagram";

    /// <summary>Google search, including the country sites.</summary>
    public const string Google = "Google";

    /// <summary>No usable referrer.</summary>
    public const string Direct = "Direct";

    /// <summary>The longest host name that is stored.</summary>
    public const int MaxLength = 253;
}
