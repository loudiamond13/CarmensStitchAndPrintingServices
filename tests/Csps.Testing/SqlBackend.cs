namespace Csps.Testing;

/// <summary>Which SQL Server the integration tests run against (D-07).</summary>
public enum SqlBackend
{
    /// <summary>The default <c>(localdb)\MSSQLLocalDB</c> instance, shared with TheBETSLLC. The only local option.</summary>
    LocalDb,

    /// <summary>A Testcontainers SQL Server 2025 container. CI only (<c>CSPS_TEST_SQL=container</c>).</summary>
    Container,
}

/// <summary>Selection of the <see cref="SqlBackend"/> from the <c>CSPS_TEST_SQL</c> process variable.</summary>
public static class SqlBackendSelection
{
    /// <summary>Name of the per-process environment variable that picks the backend.</summary>
    public const string EnvironmentVariable = "CSPS_TEST_SQL";

    extension(SqlBackend)
    {
        /// <summary>
        /// Maps a <c>CSPS_TEST_SQL</c> value to a backend. Unset or <c>localdb</c> selects LocalDB, and
        /// <c>container</c> selects the container. Pure: the caller passes the value and the OS.
        /// </summary>
        /// <param name="value">The variable's value, or null when it is not set.</param>
        /// <param name="isWindows">Whether the current OS is Windows (LocalDB exists only there).</param>
        /// <returns>The selected backend.</returns>
        /// <exception cref="InvalidOperationException">The value is unknown, or LocalDB was chosen off Windows.</exception>
        public static SqlBackend From(string? value, bool isWindows)
        {
            var normalized = value?.Trim();

            if (string.IsNullOrEmpty(normalized) || string.Equals(normalized, "localdb", StringComparison.OrdinalIgnoreCase))
            {
                return isWindows
                    ? SqlBackend.LocalDb
                    : throw new InvalidOperationException(
                        $"LocalDB exists only on Windows. On CI (Linux) set {EnvironmentVariable}=container for the test process.");
            }

            if (string.Equals(normalized, "container", StringComparison.OrdinalIgnoreCase))
            {
                return SqlBackend.Container;
            }

            throw new InvalidOperationException(
                $"{EnvironmentVariable} must be 'localdb' or 'container' (or unset for localdb), but was '{value}'.");
        }
    }
}
