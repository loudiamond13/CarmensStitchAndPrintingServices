using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Infrastructure;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.CiMailbox;

/// <summary>
/// The CI mailbox command (14 D-36). CI only; never run against a real database. It prints the newest queued sign-in code or
/// invite token for one address, so a CI script can walk the real sign-in flow without minting a token. The connection string
/// comes only from <c>CSPS_CI_MAILBOX_CONNECTION</c>, never from an argument or a prompt, and the guard runs before any
/// connection opens. Exit codes: 0 printed, 1 nothing to print or failed, 2 refused, 64 usage or settings error.
/// </summary>
public static class Program
{
    private const int Succeeded = 0;
    private const int Failed = 1;
    private const int Refused = 2;
    private const int UsageError = 64;

    private const string ConnectionVariable = "CSPS_CI_MAILBOX_CONNECTION";
    private const string Usage = "Usage: Csps.CiMailbox --to <address> --kind code|invite";

    /// <summary>Runs the command with this process's environment and console.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <returns>The exit code.</returns>
    public static Task<int> Main(string[] args) =>
        RunAsync(args, Environment.GetEnvironmentVariable, Console.Out, Console.Error, CancellationToken.None);

    /// <summary>Runs the command. Tests call this in process.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <param name="stdout">Receives only the code or token.</param>
    /// <param name="stderr">Receives refusals and failures.</param>
    /// <param name="ct">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public static async Task<int> RunAsync(
        string[] args, Func<string, string?> getEnvironmentVariable, TextWriter stdout, TextWriter stderr, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(getEnvironmentVariable);
        ArgumentNullException.ThrowIfNull(stdout);
        ArgumentNullException.ThrowIfNull(stderr);

        if (!TryParse(args, out var to, out var kind))
        {
            await stderr.WriteLineAsync(Usage).ConfigureAwait(false);
            return UsageError;
        }

        var connection = getEnvironmentVariable(ConnectionVariable);
        if (string.IsNullOrWhiteSpace(connection))
        {
            await stderr.WriteLineAsync($"No connection string. Set {ConnectionVariable} for this process. {Usage}").ConfigureAwait(false);
            return UsageError;
        }

        var check = CiMailboxTargetGuard.Check(connection, getEnvironmentVariable);
        if (!check.Allowed)
        {
            await stderr.WriteLineAsync($"Refused: {check.Reason}").ConfigureAwait(false);
            return Refused;
        }

        return await PrintAsync(to, kind, connection, settings: null, stdout, stderr, ct).ConfigureAwait(false);
    }

    // Past the guard. Tests call it with a throwaway database; the command reaches it only through RunAsync.
    internal static async Task<int> PrintAsync(
        string to, AuthEmailKind kind, string connection, IConfiguration? settings, TextWriter stdout, TextWriter stderr, CancellationToken ct)
    {
        try
        {
            var provider = CreateProvider(connection, settings);
            await using (provider.ConfigureAwait(false))
            {
                var scope = provider.CreateAsyncScope();
                await using (scope.ConfigureAwait(false))
                {
                    var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>().CreateProtector(OutboxReader.ProtectionPurpose);
                    var db = scope.ServiceProvider.GetRequiredService<CspsDbContext>();

                    var text = await OutboxReader.ReadNewestAsync(db, protector, to, kind, ct).ConfigureAwait(false);
                    if (text is null)
                    {
                        await stderr.WriteLineAsync("No queued email of that kind for that address.").ConfigureAwait(false);
                        return Failed;
                    }

                    var value = OutboxReader.Extract(kind, text);
                    if (value is null)
                    {
                        await stderr.WriteLineAsync("The queued email holds no code or token.").ConfigureAwait(false);
                        return Failed;
                    }

                    await stdout.WriteLineAsync(value).ConfigureAwait(false);
                    return Succeeded;
                }
            }
        }
        catch (Exception problem) when (problem is not OperationCanceledException)
        {
            await stderr.WriteLineAsync($"Failed: {problem.Message.Replace(connection, "[connection string]", StringComparison.Ordinal)}").ConfigureAwait(false);
            return Failed;
        }
    }

    // The same services the site uses for the database and the Data Protection key ring. Nothing starts: no host runs, so no
    // dispatcher sends mail and nothing migrates or seeds. The certificate comes from DataProtection__* in the environment.
    internal static ServiceProvider CreateProvider(string connection, IConfiguration? settings)
    {
        var builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings
        {
            DisableDefaults = true,
            EnvironmentName = Environments.Production,
        });

        builder.Configuration.AddEnvironmentVariables();
        if (settings is not null)
        {
            builder.Configuration.AddConfiguration(settings);
        }

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { [DependencyInjection.ConnectionStringKey] = connection });

        builder.Services.AddSingleton<IRequestContext, SystemRequestContext>();
        builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
        return builder.Services.BuildServiceProvider();
    }

    private static bool TryParse(string[] args, out string to, out AuthEmailKind kind)
    {
        to = string.Empty;
        kind = default;
        string? address = null;
        AuthEmailKind? parsed = null;

        if (args.Length != 4)
        {
            return false;
        }

        for (var index = 0; index < args.Length; index += 2)
        {
            switch (args[index])
            {
                case "--to" when address is null:
                    address = args[index + 1].Trim();
                    break;
                case "--kind" when parsed is null:
                    parsed = args[index + 1].ToLowerInvariant() switch
                    {
                        "code" => AuthEmailKind.SignInCode,
                        "invite" => AuthEmailKind.Invite,
                        _ => null,
                    };
                    if (parsed is null)
                    {
                        return false;
                    }

                    break;
                default:
                    return false;
            }
        }

        if (string.IsNullOrEmpty(address) || parsed is null)
        {
            return false;
        }

        to = address;
        kind = parsed.Value;
        return true;
    }
}
