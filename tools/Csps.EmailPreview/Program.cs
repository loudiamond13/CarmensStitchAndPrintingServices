using System.Text;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Domain.Time;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Csps.EmailPreview;

/// <summary>
/// The email preview tool (D-30, D-27): shows the owner all fourteen auth emails rendered (Phase 4 and Phase 5, with each variant), either sent to one address through
/// the real SMTP path (<c>--to</c>) or written as .html and .txt files (<c>--out</c>). It runs only in Development and uses
/// fixed sample values, so nothing real is ever in a preview. Exit codes: 0 done, 1 failed, 2 refused, 64 usage or settings error.
/// </summary>
public static class Program
{
    private const int Succeeded = 0;
    private const int Failed = 1;
    private const int Refused = 2;
    private const int UsageError = 64;

    // The Server's user-secrets id, so a run reads the same dev mail settings as the site.
    private const string ServerUserSecretsId = "7d33a131-9aea-4f9c-90eb-213d2b59cbee";
    private const string DefaultBaseUrl = "http://localhost:5180";
    private const string SampleAddress = "paolo.garcia@gmail.com";
    private const string SampleToken = "preview-token-not-valid";

    // 07:42 UTC is 3:42 PM in Manila, the example time of the UI-SPEC.
    private static readonly DateTimeOffset SampleTime = new(2026, 10, 14, 7, 42, 0, TimeSpan.Zero);

    /// <summary>Runs the tool with this process's environment and console.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <returns>The exit code.</returns>
    public static Task<int> Main(string[] args) =>
        RunAsync(args, Environment.GetEnvironmentVariable, null, null, Console.Out, Console.Error, CancellationToken.None);

    /// <summary>Runs the tool. Tests call this in process.</summary>
    /// <param name="args">The command-line arguments.</param>
    /// <param name="getEnvironmentVariable">Reads an environment variable of this process.</param>
    /// <param name="settings">
    /// The only settings to use, or null to read the environment and the Server's user-secrets (so a test never reads real
    /// mail settings).
    /// </param>
    /// <param name="transport">Sends the emails, or null to build the SMTP transport from the settings.</param>
    /// <param name="output">Receives the result line.</param>
    /// <param name="error">Receives refusals and failures.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public static async Task<int> RunAsync(
        string[] args,
        Func<string, string?> getEnvironmentVariable,
        IConfiguration? settings,
        IEmailTransport? transport,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken)
    {
        var environment = getEnvironmentVariable("DOTNET_ENVIRONMENT") ?? getEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        if (!string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase))
        {
            await error.WriteLineAsync(
                "Refused: the email preview runs only in Development, because it can send real mail. Set DOTNET_ENVIRONMENT=Development for this terminal.")
                .ConfigureAwait(false);
            return Refused;
        }

        EmailPreviewOptions options;
        try
        {
            options = EmailPreviewOptions.Parse(args);
        }
        catch (ArgumentException problem)
        {
            await error.WriteLineAsync(problem.Message).ConfigureAwait(false);
            return UsageError;
        }

        var configuration = settings ?? new ConfigurationBuilder().AddEnvironmentVariables().AddUserSecrets(ServerUserSecretsId).Build();
        var links = new AppLinksOptions { PublicBaseUrl = options.PublicBaseUrl ?? configuration["App:PublicBaseUrl"] ?? DefaultBaseUrl };
        if (!AppLinksOptions.IsValid(links))
        {
            await error.WriteLineAsync(AppLinksOptions.PublicBaseUrlInvalidMessage).ConfigureAwait(false);
            return UsageError;
        }

        var renderer = new EmailRenderer(new SampleCalendar(), Options.Create(links));
        var rendered = new List<(string Name, RenderedEmail Email)>();
        foreach (var (name, sample) in Samples())
        {
            rendered.Add((name, await renderer.RenderAsync(sample, cancellationToken).ConfigureAwait(false)));
        }

        if (options.OutputFolder is { } folder)
        {
            await WriteFilesAsync(folder, rendered, cancellationToken).ConfigureAwait(false);
            await output.WriteLineAsync($"Wrote {rendered.Count * 2} files to {folder}. Open the .html files in a browser.").ConfigureAwait(false);
            return Succeeded;
        }

        return await SendAsync(options.To!, rendered, configuration, transport, output, error, cancellationToken).ConfigureAwait(false);
    }

    // Name, then the sample, for the fourteen auth emails. The values are fixed and fictional.
    private static IEnumerable<(string Name, AuthEmail Email)> Samples()
    {
        var chrome = new DeviceDescription("Chrome on Android", true);
        yield return ("sign-in-code", new SignInCodeEmail(SampleAddress, "482913", SampleTime.AddMinutes(15), SampleTime, chrome));
        yield return ("account-locked", new AccountLockedEmail(SampleAddress, SampleTime.AddMinutes(15), LockoutCause.Password, TimeSpan.FromMinutes(15)));
        yield return ("reset-link", new PasswordResetEmail(SampleAddress, SampleToken, SampleTime.AddMinutes(30), SampleTime, chrome));
        yield return ("password-changed", new PasswordChangedEmail(SampleAddress, SampleTime, SessionsEnded: true));
        yield return ("manager-reset", new ManagerResetEmail(SampleAddress, "Carmen Reyes", SampleTime));
        yield return ("deactivated", new DeactivatedNoticeEmail(SampleAddress));
        yield return ("invite", new InviteEmail(SampleAddress, SampleToken, SampleTime.AddDays(7), SampleTime));
        yield return ("manager-changed-email", new ManagerEmailChangedEmail(SampleAddress, "paolo.new@gmail.com", "Carmen Reyes", SampleTime));
        yield return ("invite-by-manager", new InviteEmail(SampleAddress, SampleToken, SampleTime.AddDays(7), SampleTime, InvitedBy: "Carmen Reyes"));
        yield return ("manager-reset-link", new ManagerResetLinkEmail(SampleAddress, SampleToken, SampleTime.AddMinutes(30), SampleTime, "Carmen Reyes"));
        yield return ("email-change-confirm", new EmailChangeConfirmEmail("paolo.new@gmail.com", SampleToken, SampleTime.AddHours(24), SampleTime, SampleAddress));
        yield return (
            "email-change-confirm-by-manager",
            new EmailChangeConfirmEmail("paolo.new@gmail.com", SampleToken, SampleTime.AddHours(24), SampleTime, SampleAddress, ChangedBy: "Carmen Reyes"));
        yield return ("email-change-notice", new EmailChangeNoticeEmail(SampleAddress, "paolo.new@gmail.com", SampleTime, chrome));
        yield return ("password-changed-other-devices", new PasswordChangedEmail(SampleAddress, SampleTime, SessionsEnded: true, OtherDevicesOnly: true));
    }

    // The files are only for looking at, so the logo is inlined as a data URL there (a browser has no CID parts).
    private static async Task WriteFilesAsync(string folder, List<(string Name, RenderedEmail Email)> emails, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(folder);
        var logo = $"data:image/png;base64,{Convert.ToBase64String(EmailHtmlLayout.LogoPng())}";
        foreach (var (name, email) in emails)
        {
            var html = email.Html.Replace("cid:" + EmailHtmlLayout.LogoContentId, logo, StringComparison.Ordinal);
            await File.WriteAllTextAsync(Path.Combine(folder, $"{name}.html"), html, Encoding.UTF8, cancellationToken).ConfigureAwait(false);
            await File.WriteAllTextAsync(Path.Combine(folder, $"{name}.txt"), email.Text, Encoding.UTF8, cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task<int> SendAsync(
        string to,
        List<(string Name, RenderedEmail Email)> emails,
        IConfiguration configuration,
        IEmailTransport? transport,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken)
    {
        var smtp = configuration.GetSection(SmtpOptions.SectionName).Get<SmtpOptions>() ?? new SmtpOptions();
        if (transport is null)
        {
            // The validator's messages name the setting and never hold its value.
            var sender = ReadSender(configuration);
            var problems = new[]
            {
                new SmtpOptions.Validator().Validate(name: null, smtp),
                new EmailSenderOptions.Validator().Validate(name: null, sender),
            };
            var failed = problems.FirstOrDefault(result => result.Failed);
            if (failed is not null)
            {
                await error.WriteLineAsync(failed.FailureMessage).ConfigureAwait(false);
                return UsageError;
            }

            transport = new MailKitTransport(Options.Create(smtp), Options.Create(sender));
        }

        try
        {
            foreach (var (_, email) in emails)
            {
                await transport.SendAsync(new OutgoingEmail(to, email.Subject, email.Text, email.Html), cancellationToken).ConfigureAwait(false);
            }
        }
        catch (Exception problem) when (problem is not OperationCanceledException)
        {
            var message = string.IsNullOrEmpty(smtp.Password) ? problem.Message : problem.Message.Replace(smtp.Password, "[hidden]", StringComparison.Ordinal);
            await error.WriteLineAsync($"Failed: {message}").ConfigureAwait(false);
            return Failed;
        }

        await output.WriteLineAsync($"Sent {emails.Count} preview emails.").ConfigureAwait(false);
        return Succeeded;
    }

    // The sender is not a secret, so it defaults to the business mailbox when the dev settings do not name one.
    private static EmailSenderOptions ReadSender(IConfiguration configuration) => new()
    {
        FromAddress = configuration["Email:FromAddress"] ?? "no-reply@cspstailoring.com",
        FromName = configuration["Email:FromName"] ?? "Carmen's Stitch & Printing",
    };

    // Manila has no daylight saving, so a fixed +08:00 zone gives the same times as the site's business zone.
    private sealed class SampleCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var zone = TimeZoneInfo.CreateCustomTimeZone("Asia/Manila", TimeSpan.FromHours(8), "Asia/Manila", "Asia/Manila");
            return ValueTask.FromResult(new BusinessClock(zone, ZoneSource.FixedOffset, SampleTime));
        }
    }
}
