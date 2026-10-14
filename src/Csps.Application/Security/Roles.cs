namespace Csps.Application.Security;

/// <summary>The two staff roles (PRD section 4). They appear as the <c>role</c> claim of an access token.</summary>
public static class Roles
{
    /// <summary>Runs orders and expenses, and edits their own profile.</summary>
    public const string Admin = "Admin";

    /// <summary>Everything an Admin can do, plus users and public site content.</summary>
    public const string Manager = "Manager";
}
