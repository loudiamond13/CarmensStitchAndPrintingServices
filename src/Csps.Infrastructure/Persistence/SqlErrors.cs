using System.Data.Common;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// Finds SQL Server errors anywhere in an exception's inner chain. EF's default SQL Server strategy wraps an error it calls
/// temporary (a deadlock, a timeout, a dropped connection) in an <see cref="InvalidOperationException"/>, so a catch on the
/// outer type alone misses it.
/// </summary>
internal static class SqlErrors
{
    /// <summary>The number of a lock wait that ran out of time.</summary>
    public const int Timeout = -2;

    /// <summary>The number of a transaction chosen as a deadlock victim.</summary>
    public const int DeadlockVictim = 1205;

    /// <summary>Tells whether the error or one of its inner errors is a SQL Server error with one of the numbers.</summary>
    /// <param name="error">The caught error.</param>
    /// <param name="numbers">The SQL Server error numbers.</param>
    /// <returns>True when one of the numbers is found.</returns>
    public static bool Has(Exception? error, params ReadOnlySpan<int> numbers)
    {
        for (var current = error; current is not null; current = current.InnerException)
        {
            if (current is SqlException sql && numbers.Contains(sql.Number))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Tells whether the error or one of its inner errors is a database error of any kind.</summary>
    /// <param name="error">The caught error.</param>
    /// <returns>True when a <see cref="DbException"/> is found.</returns>
    public static bool IsDatabaseFailure(Exception? error)
    {
        for (var current = error; current is not null; current = current.InnerException)
        {
            if (current is DbException)
            {
                return true;
            }
        }

        return false;
    }
}
