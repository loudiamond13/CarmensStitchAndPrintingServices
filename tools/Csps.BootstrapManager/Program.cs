using System.Text;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Infrastructure;
using Csps.Infrastructure.DataProtection;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Csps.BootstrapManager;

/// <summary>
/// The bootstrap-manager command (AUTH-12, D-29): creates the first Manager of an empty system and queues the invite
/// the running site emails. It only parses, guards and calls <see cref="BootstrapManagerHandler"/>, and it never
/// migrates. Exit codes: 0 done, 1 failed, 2 refused, 64 usage or settings error. The connection string comes from
/// <c>CSPS_BOOTSTRAP_CONNECTION</c> or a hidden prompt, never from an argument (CWE-214), and no message repeats it.
/// </summary>
public static class Program
{
    private const int Succeeded = 0;
    private const int Failed = 1;
    private const int Refused = 2;
    private const int UsageError = 64;

    // The Server's user-secrets id, so a Development run reads the same dev settings (certificate, mail).
    private const string ServerUserSecretsId = "7d33a131-9aea-4f9c-90eb-213d2b59cbee";

    /// <summary>Runs the command with this process's environment, console and hidden prompt.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <returns>The exit code.</returns>
    public static Task<int> Main(string[] args) =>
        RunAsync(args, Environment.GetEnvironmentVariable, null, PromptForConnection, Console.Out, Console.Error, CancellationToken.None);

    /// <summary>Runs the command. Tests call this in process.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <param name="settings">Extra settings layered over the environment (the certificate in tests), or null.</param>
    /// <param name="promptForConnection">Reads the connection string without echo when the variable is not set, or null for none.</param>
    /// <param name="output">Receives progress and the result line.</param>
    /// <param name="error">Receives refusals and failures.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public static async Task<int> RunAsync(
        string[] args,
        Func<string, string?> getEnvironmentVariable,
        IConfiguration? settings,
        Func<string?>? promptForConnection,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken)
    {
        BootstrapManagerOptions options;
        try
        {
            options = BootstrapManagerOptions.Parse(args, getEnvironmentVariable);
        }
        catch (ArgumentException problem)
        {
            await error.WriteLineAsync(problem.Message).ConfigureAwait(false);
            return UsageError;
        }

        var connection = options.ConnectionString ?? promptForConnection?.Invoke();
        if (string.IsNullOrWhiteSpace(connection))
        {
            await error.WriteLineAsync(
                $"No connection string. Set {BootstrapManagerOptions.ConnectionVariable} for this process, or run in a terminal to use the hidden prompt. {BootstrapManagerOptions.Usage}")
                .ConfigureAwait(false);
            return UsageError;
        }

        var check = BootstrapTargetGuard.Check(connection, options.ConfirmDatabase);
        if (!check.Allowed)
        {
            await error.WriteLineAsync($"Refused: {check.Reason}").ConfigureAwait(false);
            return Refused;
        }

        try
        {
            return await CreateFirstManagerAsync(options, connection, check.DatabaseName!, getEnvironmentVariable, settings, output, error, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception problem) when (problem is not OperationCanceledException)
        {
            await error.WriteLineAsync($"Failed: {problem.Message.Replace(connection, "[connection string]", StringComparison.Ordinal)}").ConfigureAwait(false);
            return Failed;
        }
    }

    private static async Task<int> CreateFirstManagerAsync(
        BootstrapManagerOptions options,
        string connection,
        string database,
        Func<string, string?> getEnvironmentVariable,
        IConfiguration? settings,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken)
    {
        var builder = Host.CreateEmptyApplicationBuilder(new HostApplicationBuilderSettings
        {
            DisableDefaults = true,
            EnvironmentName = getEnvironmentVariable("DOTNET_ENVIRONMENT") ?? getEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environments.Production,
        });

        // Later sources win: environment, dev user-secrets, caller settings, then the values this run was given.
        builder.Configuration.AddEnvironmentVariables();
        if (builder.Environment.IsDevelopment())
        {
            builder.Configuration.AddUserSecrets(ServerUserSecretsId);
        }

        if (settings is not null)
        {
            builder.Configuration.AddConfiguration(settings);
        }

        var given = new Dictionary<string, string?> { [DependencyInjection.ConnectionStringKey] = connection };
        if (options.PublicBaseUrl is not null)
        {
            given[AppLinksOptions.SectionName + ":PublicBaseUrl"] = options.PublicBaseUrl;
        }

        builder.Configuration.AddInMemoryCollection(given);

        var auth = builder.Configuration.GetSection(AuthSettings.SectionName).Get<AuthSettings>() ?? new AuthSettings();
        var problems = auth.Validate();
        if (problems.Count > 0)
        {
            await error.WriteLineAsync($"Failed: {string.Join(" ", problems)}").ConfigureAwait(false);
            return Failed;
        }

        builder.Services.AddSingleton<IRequestContext, SystemRequestContext>();
        builder.Services.AddSingleton(auth);
        builder.Services.AddSingleton<IValidator<BootstrapManagerCommand>, BootstrapManagerCommandValidator>();
        builder.Services.AddScoped<BootstrapManagerHandler>();
        builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

        var provider = builder.Services.BuildServiceProvider();
        await using (provider.ConfigureAwait(false))
        {
            // Reading an option runs its validator; the messages name the setting and never hold its value.
            try
            {
                _ = provider.GetRequiredService<IOptions<AppLinksOptions>>().Value;
            }
            catch (OptionsValidationException problem)
            {
                await error.WriteLineAsync(problem.Message).ConfigureAwait(false);
                return UsageError;
            }

            try
            {
                _ = provider.GetRequiredService<IOptions<DataProtectionSettings>>().Value;
            }
            catch (OptionsValidationException problem)
            {
                await error.WriteLineAsync($"Failed: {problem.Message}").ConfigureAwait(false);
                return Failed;
            }

            var scope = provider.CreateAsyncScope();
            await using (scope.ConfigureAwait(false))
            {
                var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
                var pending = (await context.Database.GetPendingMigrationsAsync(cancellationToken).ConfigureAwait(false)).Count();
                if (pending > 0)
                {
                    await error.WriteLineAsync(
                        $"Refused: {database} is missing {pending} migration(s). Apply the reviewed migration script first; this command never migrates.")
                        .ConfigureAwait(false);
                    return Refused;
                }

                var email = options.Email.Trim();
                var handler = scope.ServiceProvider.GetRequiredService<BootstrapManagerHandler>();
                var result = await handler
                    .HandleAsync(new BootstrapManagerCommand(email, options.FirstName, options.LastName), cancellationToken)
                    .ConfigureAwait(false);

                if (result.IsSuccess)
                {
                    await output.WriteLineAsync($"Invite queued for {email}. The running CSPS site sends it within a minute.").ConfigureAwait(false);
                    return Succeeded;
                }

                return await ReportAsync(result.Error, error).ConfigureAwait(false);
            }
        }
    }

    private static async Task<int> ReportAsync(Error failure, TextWriter error)
    {
        if (failure.Kind == ErrorKind.Validation && failure.FieldErrors is { } fields)
        {
            foreach (var (field, messages) in fields)
            {
                foreach (var message in messages)
                {
                    await error.WriteLineAsync($"{field}: {message}").ConfigureAwait(false);
                }
            }

            return UsageError;
        }

        await error.WriteLineAsync($"Refused: {failure.Message}").ConfigureAwait(false);
        return failure.Kind == ErrorKind.BusinessRule ? Refused : Failed;
    }

    // Reads a line without echo. Returns null when input is piped, so a script must use the environment variable.
    private static string? PromptForConnection()
    {
        if (Console.IsInputRedirected)
        {
            return null;
        }

        Console.Error.Write("Connection string (hidden): ");
        var typed = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                break;
            }

            if (key.Key == ConsoleKey.Backspace)
            {
                if (typed.Length > 0)
                {
                    typed.Length--;
                }
            }
            else if (!char.IsControl(key.KeyChar))
            {
                typed.Append(key.KeyChar);
            }
        }

        Console.Error.WriteLine();
        return typed.ToString();
    }
}
