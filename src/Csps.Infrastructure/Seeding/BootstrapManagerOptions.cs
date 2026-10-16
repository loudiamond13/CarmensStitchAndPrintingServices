namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Command-line options of <c>tools/Csps.BootstrapManager</c> (AUTH-12, D-29). The connection string is never an
/// argument (CWE-214: it would sit in the shell history and the process list): it comes from
/// <see cref="ConnectionVariable"/> or a hidden prompt. Error messages never repeat an argument value, because a
/// mistyped argument could be a password.
/// </summary>
public sealed class BootstrapManagerOptions
{
    /// <summary>The environment variable that holds the connection string for this process.</summary>
    public const string ConnectionVariable = "CSPS_BOOTSTRAP_CONNECTION";

    /// <summary>One-line usage text.</summary>
    public const string Usage =
        "Usage: dotnet run --project tools/Csps.BootstrapManager -- --email <address> --first-name <name> --last-name <name> "
        + "--confirm-database <database> [--public-base-url <https://site>]. "
        + "Set " + ConnectionVariable + " to the connection string, or enter it at the hidden prompt.";

    private const string EmailFlag = "--email";
    private const string FirstNameFlag = "--first-name";
    private const string LastNameFlag = "--last-name";
    private const string ConfirmFlag = "--confirm-database";
    private const string BaseUrlFlag = "--public-base-url";
    private const string ConnectionFlag = "--connection";

    private BootstrapManagerOptions(string email, string firstName, string lastName, string confirmDatabase, string? publicBaseUrl, string? connectionString)
    {
        Email = email;
        FirstName = firstName;
        LastName = lastName;
        ConfirmDatabase = confirmDatabase;
        PublicBaseUrl = publicBaseUrl;
        ConnectionString = connectionString;
    }

    /// <summary>Gets the first Manager's sign-in email.</summary>
    public string Email { get; }

    /// <summary>Gets the first Manager's given name.</summary>
    public string FirstName { get; }

    /// <summary>Gets the first Manager's family name.</summary>
    public string LastName { get; }

    /// <summary>Gets the database name the operator confirms.</summary>
    public string ConfirmDatabase { get; }

    /// <summary>Gets the site's public address for the invite link, or null to use the <c>App:PublicBaseUrl</c> setting.</summary>
    public string? PublicBaseUrl { get; }

    /// <summary>Gets the connection string from the environment, or null when the hidden prompt must supply it.</summary>
    public string? ConnectionString { get; }

    /// <summary>Parses the arguments. Flags are case-sensitive.</summary>
    /// <param name="args">The arguments after <c>--</c>.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <returns>The options.</returns>
    /// <exception cref="ArgumentException">An argument is unknown, repeated, missing its value or a connection argument.</exception>
    public static BootstrapManagerOptions Parse(string[] args, Func<string, string?> getEnvironmentVariable)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(getEnvironmentVariable);

        string? email = null;
        string? firstName = null;
        string? lastName = null;
        string? confirm = null;
        string? baseUrl = null;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case EmailFlag:
                    email = TakeValue(args, ref index, EmailFlag, email);
                    break;
                case FirstNameFlag:
                    firstName = TakeValue(args, ref index, FirstNameFlag, firstName);
                    break;
                case LastNameFlag:
                    lastName = TakeValue(args, ref index, LastNameFlag, lastName);
                    break;
                case ConfirmFlag:
                    confirm = TakeValue(args, ref index, ConfirmFlag, confirm);
                    break;
                case BaseUrlFlag:
                    baseUrl = TakeValue(args, ref index, BaseUrlFlag, baseUrl);
                    break;
                default:
                    throw UnknownArgument(args[index]);
            }
        }

        var connection = getEnvironmentVariable(ConnectionVariable);
        return new BootstrapManagerOptions(
            email ?? throw Missing(EmailFlag),
            firstName ?? throw Missing(FirstNameFlag),
            lastName ?? throw Missing(LastNameFlag),
            confirm ?? throw Missing(ConfirmFlag),
            baseUrl,
            string.IsNullOrWhiteSpace(connection) ? null : connection);
    }

    /// <summary>Returns a copy that uses <paramref name="connectionString"/>, for a value read at the hidden prompt.</summary>
    /// <param name="connectionString">The connection string.</param>
    /// <returns>The new options.</returns>
    public BootstrapManagerOptions WithConnectionString(string connectionString) =>
        new(Email, FirstName, LastName, ConfirmDatabase, PublicBaseUrl, connectionString);

    /// <summary>Returns the type name only, so no value reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(BootstrapManagerOptions);

    private static string TakeValue(string[] args, ref int index, string flag, string? current)
    {
        if (current is not null)
        {
            throw UsageError($"{flag} was given more than once.");
        }

        var valueIndex = index + 1;
        if (valueIndex >= args.Length
            || string.IsNullOrWhiteSpace(args[valueIndex])
            || args[valueIndex].StartsWith("--", StringComparison.Ordinal))
        {
            throw UsageError($"{flag} needs a value.");
        }

        index = valueIndex;
        return args[valueIndex];
    }

    // Names only the flag, never what follows "=" or the next argument: either could be a secret.
    private static ArgumentException UnknownArgument(string argument)
    {
        if (argument.StartsWith(ConnectionFlag, StringComparison.Ordinal))
        {
            return UsageError(
                $"The connection string is never taken as an argument, because it would show in the shell history. Set {ConnectionVariable} for this process instead.");
        }

        var flag = argument.StartsWith("--", StringComparison.Ordinal) ? argument.Split('=')[0] : null;
        return UsageError(flag is null ? "An unexpected value was given." : $"Unknown argument {flag}.");
    }

    private static ArgumentException Missing(string flag) => UsageError($"{flag} is required.");

    private static ArgumentException UsageError(string message) => new($"{message} {Usage}");
}
