using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.LegacyFitCheck.Source;

/// <summary>
/// Lets only LINQ reads through to the legacy restore (D-14). A reader command passes only when EF built it from a LINQ query and its
/// text starts with SELECT. Every non-query and scalar command is refused. The guard reads the command text and never sets it.
/// </summary>
internal sealed class ReadOnlyCommandGuard : DbCommandInterceptor
{
    private const string Refusal = "The legacy restore is read-only. Only LINQ reads are allowed.";

    public static bool IsAllowedRead(CommandSource source, string commandText) =>
        source == CommandSource.LinqQuery
        && commandText is not null
        && commandText.AsSpan().TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase);

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        ThrowUnlessAllowedRead(command, eventData);
        return result;
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        ThrowUnlessAllowedRead(command, eventData);
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<int> result) =>
        throw Refused();

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default) =>
        throw Refused();

    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<object> result) =>
        throw Refused();

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command,
        CommandEventData eventData,
        InterceptionResult<object> result,
        CancellationToken cancellationToken = default) =>
        throw Refused();

    private static void ThrowUnlessAllowedRead(DbCommand command, CommandEventData eventData)
    {
        if (!IsAllowedRead(eventData.CommandSource, command.CommandText))
        {
            throw Refused();
        }
    }

    private static InvalidOperationException Refused() => new(Refusal);
}
