#if CSPS_TESTING
using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Keeps the Testing demo reset away from any database but the end-to-end one and the per-test ones (<c>CSPS_E2E</c> and
/// <c>CSPS_Test_&lt;guid&gt;</c>). The reset rewrites site content and the website state of every order, so a host pointed at
/// <c>CSPS_Dev</c> or a copy of real data must be refused. The name is read from the context's connection, which opens nothing.
/// </summary>
public static partial class TestingDatabaseGuard
{
    /// <summary>The plain-English refusal. It never repeats the database name.</summary>
    public const string Refusal = "The demo reset only runs on the end-to-end test database (CSPS_E2E) or a per-test database (CSPS_Test_<guid>). This host is connected to another database, so nothing was changed.";

    /// <summary>Checks the database the context is connected to.</summary>
    /// <param name="context">The database context.</param>
    /// <returns>True when the reset may run on it.</returns>
    public static bool Allows(CspsDbContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return IsAllowedName(context.Database.GetDbConnection().Database);
    }

    /// <summary>Checks a database name against the allow-list.</summary>
    /// <param name="name">The database name.</param>
    /// <returns>True for <c>CSPS_E2E</c> and <c>CSPS_Test_&lt;guid&gt;</c>.</returns>
    public static bool IsAllowedName(string? name) => !string.IsNullOrEmpty(name) && Allowed().IsMatch(name);

    [GeneratedRegex("^(CSPS_E2E|CSPS_Test_[0-9a-f-]{36})$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex Allowed();
}
#endif
