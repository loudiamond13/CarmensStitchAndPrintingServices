using Csps.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using PreviewProgram = Csps.EmailPreview.Program;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>
/// D-30, D-27: the preview tool shows the owner all fourteen emails rendered (every Phase 4 and Phase 5 email and variant). It runs only in Development, takes either an
/// address or a folder, never opens SMTP when writing files and never sends real mail in a test.
/// </summary>
public sealed class EmailPreviewTests
{
    private const string Address = "owner@example.com";
    private const string SecretPassword = "never-print-this-password-9f3a";

    private static readonly string[] ExpectedNames =
    [
        "account-locked", "deactivated", "email-change-confirm", "email-change-confirm-by-manager", "email-change-notice", "invite",
        "invite-by-manager", "manager-changed-email", "manager-reset", "manager-reset-link", "password-changed",
        "password-changed-other-devices", "reset-link", "sign-in-code",
    ];

    [Fact]
    public void OptionsNeedAnAddressOrAFolderButNotBoth()
    {
        EmailPreviewOptions.Parse(["--to", Address]).To.ShouldBe(Address);
        EmailPreviewOptions.Parse(["--out", "previews"]).OutputFolder.ShouldBe("previews");
        EmailPreviewOptions.Parse(["--out", "previews", "--public-base-url", "https://csps.example.com"]).PublicBaseUrl.ShouldBe("https://csps.example.com");

        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse([])).Message.ShouldContain("--to");
        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse(["--to", Address, "--out", "previews"])).Message.ShouldContain("not both");
        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse(["--to", "not-an-address"])).Message.ShouldContain("--to");
        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse(["--to"])).Message.ShouldContain("needs a value");
        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse(["--to", Address, "--to", Address])).Message.ShouldContain("more than once");
        Should.Throw<ArgumentException>(() => EmailPreviewOptions.Parse(["--password", SecretPassword])).Message.ShouldNotContain(SecretPassword);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task OutsideDevelopmentItRefusesAndWritesNothing(string? environment)
    {
        var folder = NewFolder();
        var transport = new RecordingTransport();

        var run = await RunAsync(["--out", folder], environment, Settings(), transport);

        run.ExitCode.ShouldBe(2);
        run.Error.ShouldContain("Development");
        Directory.Exists(folder).ShouldBeFalse();
        transport.Sent.ShouldBeEmpty();
    }

    [Fact]
    public async Task OutWritesFourteenHtmlAndFourteenTextFilesAndNeverTouchesSmtp()
    {
        var folder = NewFolder();
        try
        {
            var transport = new RecordingTransport();

            var run = await RunAsync(["--out", folder], "Development", Settings(), transport);

            run.ExitCode.ShouldBe(0, run.Error);
            transport.Sent.ShouldBeEmpty();
            var files = Directory.GetFiles(folder).Select(Path.GetFileName).Order(StringComparer.Ordinal).ToList();
            files.Count.ShouldBe(28);
            files.ShouldBe(ExpectedNames.SelectMany(name => new[] { $"{name}.html", $"{name}.txt" }).Order(StringComparer.Ordinal));

            var signInHtml = await File.ReadAllTextAsync(Path.Combine(folder, "sign-in-code.html"), TestContext.Current.CancellationToken);
            signInHtml.ShouldContain("482913");
            signInHtml.ShouldContain("src=\"data:image/png;base64,");
            signInHtml.ShouldNotContain("cid:");
            (await File.ReadAllTextAsync(Path.Combine(folder, "sign-in-code.txt"), TestContext.Current.CancellationToken)).ShouldContain("482913");
            (await File.ReadAllTextAsync(Path.Combine(folder, "reset-link.txt"), TestContext.Current.CancellationToken)).ShouldContain("preview-token-not-valid");
            (await File.ReadAllTextAsync(Path.Combine(folder, "manager-reset.html"), TestContext.Current.CancellationToken)).ShouldContain("Carmen Reyes");
            (await File.ReadAllTextAsync(Path.Combine(folder, "manager-changed-email.txt"), TestContext.Current.CancellationToken))
                .ShouldContain("Carmen Reyes changed your sign-in email to paolo.new@gmail.com.");
            (await File.ReadAllTextAsync(Path.Combine(folder, "invite-by-manager.txt"), TestContext.Current.CancellationToken))
                .ShouldContain("Carmen Reyes set up your account.");
            var managerLink = await File.ReadAllTextAsync(Path.Combine(folder, "manager-reset-link.txt"), TestContext.Current.CancellationToken);
            managerLink.ShouldContain("Carmen Reyes sent you this link");
            managerLink.ShouldContain("preview-token-not-valid");
            (await File.ReadAllTextAsync(Path.Combine(folder, "email-change-confirm.txt"), TestContext.Current.CancellationToken))
                .ShouldContain("You asked to change the sign-in email");
            (await File.ReadAllTextAsync(Path.Combine(folder, "email-change-confirm-by-manager.txt"), TestContext.Current.CancellationToken))
                .ShouldContain("Carmen Reyes changed the sign-in email");
            (await File.ReadAllTextAsync(Path.Combine(folder, "email-change-notice.txt"), TestContext.Current.CancellationToken))
                .ShouldContain("Someone asked to change the sign-in email");
            var everywhere = await File.ReadAllTextAsync(Path.Combine(folder, "password-changed.txt"), TestContext.Current.CancellationToken);
            var otherDevices = await File.ReadAllTextAsync(Path.Combine(folder, "password-changed-other-devices.txt"), TestContext.Current.CancellationToken);
            otherDevices.ShouldNotBe(everywhere);
            run.Output.ShouldContain("28 files");
        }
        finally
        {
            DeleteFolder(folder);
        }
    }

    [Fact]
    public async Task ToSendsTheFourteenSamplesToTheOneAddressAndPrintsOnlyTheCount()
    {
        var transport = new RecordingTransport();

        var run = await RunAsync(["--to", Address], "Development", Settings(), transport);

        run.ExitCode.ShouldBe(0, run.Error);
        transport.Sent.Count.ShouldBe(14);
        transport.Sent.ShouldAllBe(email => email.To == Address);
        transport.Sent.Select(email => email.Subject).Distinct(StringComparer.Ordinal).Count().ShouldBe(14);
        transport.Sent.ShouldContain(email => email.Subject == "482913 is your CSPS sign-in code");
        transport.Sent.ShouldAllBe(email => email.Html.Contains("cid:csps-logo", StringComparison.Ordinal));
        run.Output.Trim().ShouldBe("Sent 14 preview emails.");
        run.Output.ShouldNotContain(Address);
    }

    [Fact]
    public async Task ToWithoutMailSettingsIsASettingsErrorThatNamesTheSettingNotItsValue()
    {
        var settings = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Smtp:Password"] = SecretPassword })
            .Build();

        var run = await RunAsync(["--to", Address], "Development", settings, transport: null);

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldContain("Smtp:Host");
        run.Error.ShouldNotContain(SecretPassword);
        run.Output.ShouldBeEmpty();
    }

    [Fact]
    public async Task BadArgumentsAreAUsageError()
    {
        var run = await RunAsync([], "Development", Settings(), new RecordingTransport());

        run.ExitCode.ShouldBe(64);
        run.Error.ShouldContain("Usage:");
    }

    private static IConfiguration Settings() => new ConfigurationBuilder().AddInMemoryCollection().Build();

    private static string NewFolder() => Path.Combine(Path.GetTempPath(), "csps-email-preview-" + Guid.NewGuid().ToString("N"));

    private static void DeleteFolder(string folder)
    {
        if (Directory.Exists(folder))
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    private static async Task<CommandRun> RunAsync(string[] args, string? environment, IConfiguration settings, IEmailTransport? transport)
    {
        var output = new StringWriter();
        var error = new StringWriter();

        var exitCode = await PreviewProgram.RunAsync(
            args,
            name => name == "DOTNET_ENVIRONMENT" ? environment : null,
            settings,
            transport,
            output,
            error,
            TestContext.Current.CancellationToken);

        return new CommandRun(exitCode, output.ToString(), error.ToString());
    }

    private sealed record CommandRun(int ExitCode, string Output, string Error);

    private sealed class RecordingTransport : IEmailTransport
    {
        public List<OutgoingEmail> Sent { get; } = [];

        public Task SendAsync(OutgoingEmail email, CancellationToken cancellationToken)
        {
            Sent.Add(email);
            return Task.CompletedTask;
        }
    }
}
