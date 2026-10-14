namespace Csps.Application.Security;

/// <summary>
/// Names of the authorization policies (SEC-02, PRD section 4). Every endpoint that is not on the anonymous
/// allow-list must name one of these constants; the authorization coverage test reads them by reflection.
/// </summary>
public static class Policies
{
    /// <summary>Any staff member: the Admin or Manager role.</summary>
    public const string Staff = "Staff";

    /// <summary>Managers only (user management, site content).</summary>
    public const string Manager = "Manager";
}
