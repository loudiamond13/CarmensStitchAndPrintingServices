using System.Collections.Concurrent;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Testing;

/// <summary>
/// Counts the SQL commands a context runs, for N+1 guards. Thread-safe. <see cref="Count"/> and <see cref="Commands"/> see every
/// command since the last <see cref="Reset"/>, from any flow; <see cref="MeasureAsync{T}"/> sees only the work it runs.
/// </summary>
public sealed class CommandCounter : DbCommandInterceptor
{
    private readonly AsyncLocal<ConcurrentQueue<string>?> _measured = new();
    private ConcurrentQueue<string> _all = new();
    private int _count;

    /// <summary>How many commands ran since the last <see cref="Reset"/>.</summary>
    public int Count => Volatile.Read(ref _count);

    /// <summary>The text of every command since the last <see cref="Reset"/>, oldest first.</summary>
    public IReadOnlyList<string> Commands => [.. Volatile.Read(ref _all)];

    /// <summary>Sets the count back to zero and clears <see cref="Commands"/>.</summary>
    public void Reset()
    {
        Volatile.Write(ref _all, new ConcurrentQueue<string>());
        Interlocked.Exchange(ref _count, 0);
    }

    /// <summary>
    /// Runs <paramref name="work"/> and returns the commands that ran in its own async flow. Commands from other flows on the same
    /// host, such as the email dispatcher's background read, are left out. A test server needs <c>PreserveExecutionContext</c> set,
    /// or its requests run outside this flow and none of their commands are seen.
    /// </summary>
    /// <typeparam name="T">The type of the work's result.</typeparam>
    /// <param name="work">The work to measure.</param>
    /// <returns>The work's result and the text of each command it ran, oldest first.</returns>
    public async Task<MeasuredCommands<T>> MeasureAsync<T>(Func<Task<T>> work)
    {
        ArgumentNullException.ThrowIfNull(work);
        var commands = new ConcurrentQueue<string>();
        _measured.Value = commands;
        var result = await work().ConfigureAwait(false);
        return new MeasuredCommands<T>(result, [.. commands]);
    }

    /// <inheritdoc />
    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Record(command);
        return base.ReaderExecuting(command, eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Record(command);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }

    /// <inheritdoc />
    public override InterceptionResult<object> ScalarExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    {
        Record(command);
        return base.ScalarExecuting(command, eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result, CancellationToken cancellationToken = default)
    {
        Record(command);
        return base.ScalarExecutingAsync(command, eventData, result, cancellationToken);
    }

    /// <inheritdoc />
    public override InterceptionResult<int> NonQueryExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result)
    {
        Record(command);
        return base.NonQueryExecuting(command, eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Record(command);
        return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
    }

    private void Record(DbCommand command)
    {
        Interlocked.Increment(ref _count);
        Volatile.Read(ref _all).Enqueue(command.CommandText);
        _measured.Value?.Enqueue(command.CommandText);
    }
}

/// <summary>What <see cref="CommandCounter.MeasureAsync{T}"/> saw.</summary>
/// <typeparam name="T">The type of the work's result.</typeparam>
/// <param name="Result">The work's result.</param>
/// <param name="Commands">The text of each command the work ran, oldest first.</param>
public sealed record MeasuredCommands<T>(T Result, IReadOnlyList<string> Commands)
{
    /// <summary>How many commands the work ran.</summary>
    public int Count => Commands.Count;
}
