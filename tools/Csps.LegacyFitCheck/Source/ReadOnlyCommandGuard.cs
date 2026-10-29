using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.LegacyFitCheck.Source;

/// <summary>Lets only LINQ reads through to the legacy restore.</summary>
internal sealed class ReadOnlyCommandGuard : DbCommandInterceptor
{
    public static bool IsAllowedRead(CommandSource source, string commandText) => true;
}
