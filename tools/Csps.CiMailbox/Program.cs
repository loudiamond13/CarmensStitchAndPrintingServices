using Csps.Application.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.CiMailbox;

/// <summary>The CI mailbox command (14 D-36). CI only; never run against a real database.</summary>
public static class Program
{
    /// <summary>Runs the command with this process's environment and console.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <returns>The exit code.</returns>
    public static Task<int> Main(string[] args) =>
        RunAsync(args, Environment.GetEnvironmentVariable, Console.Out, Console.Error, CancellationToken.None);

    /// <summary>Runs the command. Tests call this in process.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <param name="stdout">Receives the value.</param>
    /// <param name="stderr">Receives refusals and failures.</param>
    /// <param name="ct">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public static Task<int> RunAsync(
        string[] args, Func<string, string?> getEnvironmentVariable, TextWriter stdout, TextWriter stderr, CancellationToken ct) =>
        Task.FromResult(0);

    internal static Task<int> PrintAsync(
        string to, AuthEmailKind kind, string connection, IConfiguration? settings, TextWriter stdout, TextWriter stderr, CancellationToken ct) =>
        Task.FromResult(0);

    internal static ServiceProvider CreateProvider(string connection, IConfiguration? settings) => throw new NotImplementedException();
}
