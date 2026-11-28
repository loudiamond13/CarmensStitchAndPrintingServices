using System.Reflection;
using Csps.Application.Email;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.CiMailbox.Tests;

/// <summary>
/// 14 D-36: the tool reads the newest open outbox row for one address and kind, with the app's own protection purpose,
/// and prints only the code. It also refuses every target but the CI container, before any connection opens.
/// </summary>
public sealed class OutboxReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Code = "482913";

    // The text part of a sign-in code email, copied from EmailRenderer (the renderer is internal to Csps.Infrastructure).
    private const string SignInCodeText =
        "Your sign-in code\n\n482913\n\nEnter this code on the CSPS sign-in screen. It works for 10 minutes and only once.\n\n"
        + "Requested Nov 27, 2026, 6:31 PM from Chrome on Windows.\n\n";

    private static readonly DateTimeOffset Noon = new(2026, 11, 27, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void ThePurposeEqualsTheOneTheSiteQueuesWith()
    {
        var sender = typeof(EmailOutboxMessage).Assembly.GetType("Csps.Infrastructure.Email.OutboxEmailSender", throwOnError: true)!;
        var field = sender.GetField("ProtectionPurpose", BindingFlags.NonPublic | BindingFlags.Static);

        field.ShouldNotBeNull();
        OutboxReader.ProtectionPurpose.ShouldBe((string?)field.GetRawConstantValue());
    }

    [Fact]
    public async Task ReturnsTheTextOfAQueuedSignInCodeAndExtractsTheSixDigits()
    {
        var to = Address();
        var protector = Protector();
        await QueueAsync(protector, to, AuthEmailKind.SignInCode, SignInCodeText, Noon);

        var text = await Read(protector, to, AuthEmailKind.SignInCode);

        text.ShouldBe(SignInCodeText);
        OutboxReader.Extract(AuthEmailKind.SignInCode, text.ShouldNotBeNull()).ShouldBe(Code);
    }

    [Fact]
    public async Task PrintsOnlyTheCodeThroughTheWholeToolAndOnlyTheCode()
    {
        var to = Address();
        await using var provider = Program.CreateProvider(database.ConnectionString, Settings());
        var protector = provider.GetRequiredService<IDataProtectionProvider>().CreateProtector(OutboxReader.ProtectionPurpose);
        await QueueAsync(protector, to, AuthEmailKind.SignInCode, SignInCodeText, Noon);
        var stdout = new StringWriter();
        var stderr = new StringWriter();

        var exit = await Program.PrintAsync(to, AuthEmailKind.SignInCode, database.ConnectionString, Settings(), stdout, stderr, TestContext.Current.CancellationToken);

        exit.ShouldBe(0, stderr.ToString());
        stdout.ToString().ShouldBe(Code + Environment.NewLine);
        stderr.ToString().ShouldBeEmpty();
    }

    [Fact]
    public async Task RefusesALocalDbTargetBeforeAnyConnectionOpens()
    {
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        var environment = new Dictionary<string, string?>
        {
            ["GITHUB_ACTIONS"] = "true",
            ["CSPS_CI_MAILBOX_CONNECTION"] = database.ConnectionString,
        };

        var exit = await Program.RunAsync(
            ["--to", "a@example.test", "--kind", "code"], name => environment.GetValueOrDefault(name), stdout, stderr, TestContext.Current.CancellationToken);

        exit.ShouldBe(2);
        stderr.ToString().ShouldStartWith("Refused:");
        stderr.ToString().ShouldNotContain(database.ConnectionString);
        stdout.ToString().ShouldBeEmpty();
    }

    [Theory]
    [InlineData("tok_abc-123", "tok_abc-123")]
    [InlineData("ab%2B%2F%3Dcd", "ab+/=cd")]
    public void ExtractsTheInviteTokenAndNothingElse(string linkToken, string expected) =>
        OutboxReader.Extract(AuthEmailKind.Invite, InviteText(linkToken)).ShouldBe(expected);

    // A link wrapped in brackets or ended by a full stop must not drag that punctuation into the token.
    // "{0}" in the wrapper stands for the link.
    [Theory]
    [InlineData("({0})", "tok_abc-123", "tok_abc-123")]
    [InlineData("Open {0}.", "tok_abc-123", "tok_abc-123")]
    [InlineData("Open {0}, then sign in.", "tok_abc-123", "tok_abc-123")]
    [InlineData("<{0}>", "tok_abc-123", "tok_abc-123")]
    [InlineData("\"{0}\"", "ab%2B%2F%3Dcd", "ab+/=cd")]
    [InlineData("{0}.", "tok.abc~123", "tok.abc~123")]
    public void ExtractsTheInviteTokenWhenTheLinkIsWrappedInPunctuation(string wrapper, string linkToken, string expected)
    {
        var link = $"https://csps.example.test/admin/accept-invite#token={linkToken}";

        OutboxReader.Extract(AuthEmailKind.Invite, wrapper.Replace("{0}", link, StringComparison.Ordinal)).ShouldBe(expected);
    }

    [Fact]
    public void ExtractsNothingFromATextWithoutACodeOrToken()
    {
        OutboxReader.Extract(AuthEmailKind.SignInCode, "Your sign-in code\n\nRequested Nov 27, 2026, 6:31 PM\n\n").ShouldBeNull();
        OutboxReader.Extract(AuthEmailKind.Invite, "You're invited\n\nNo link here.\n").ShouldBeNull();
        OutboxReader.Extract(AuthEmailKind.PasswordReset, InviteText("tok_abc-123")).ShouldBeNull();
    }

    [Fact]
    public async Task TheNewerRowWinsEvenWhenSqlServerSortsItsIdLower()
    {
        var to = Address();
        var protector = Protector();
        await QueueAsync(protector, to, AuthEmailKind.SignInCode, SignInCodeText.Replace(Code, "111111", StringComparison.Ordinal), Noon, Guid.Parse("00000000-0000-7000-8000-ffffffffffff"));
        await QueueAsync(protector, to, AuthEmailKind.SignInCode, SignInCodeText, Noon.AddMinutes(5), Guid.Parse("ffffffff-ffff-7fff-bfff-000000000000"));

        var text = await Read(protector, to, AuthEmailKind.SignInCode);

        OutboxReader.Extract(AuthEmailKind.SignInCode, text.ShouldNotBeNull()).ShouldBe(Code);
    }

    [Fact]
    public async Task AClosedRowIsSkippedAndTheToolSaysSoInPlainWords()
    {
        var to = Address();
        var protector = Protector();
        await QueueAsync(protector, to, AuthEmailKind.SignInCode, SignInCodeText, Noon);
        await CloseAsync(to);
        var stdout = new StringWriter();
        var stderr = new StringWriter();

        (await Read(protector, to, AuthEmailKind.SignInCode)).ShouldBeNull();
        var exit = await Program.PrintAsync(to, AuthEmailKind.SignInCode, database.ConnectionString, Settings(), stdout, stderr, TestContext.Current.CancellationToken);

        exit.ShouldBe(1);
        stderr.ToString().Trim().ShouldBe("No queued email of that kind for that address.");
        stdout.ToString().ShouldBeEmpty();
    }

    [Fact]
    public async Task ARowForAnotherRecipientOrAnotherKindIsNeverReturned()
    {
        var to = Address();
        var protector = Protector();
        await QueueAsync(protector, Address(), AuthEmailKind.SignInCode, SignInCodeText, Noon);
        await QueueAsync(protector, to, AuthEmailKind.Invite, InviteText("tok_abc-123"), Noon);

        (await Read(protector, to, AuthEmailKind.SignInCode)).ShouldBeNull();
        OutboxReader.Extract(AuthEmailKind.Invite, (await Read(protector, to, AuthEmailKind.Invite)).ShouldNotBeNull()).ShouldBe("tok_abc-123");
    }

    // Arguments are joined with "|" so a row reads as one line; "<empty>" stands for an empty argument.
    [Theory]
    [InlineData("")]
    [InlineData("--kind|code")]
    [InlineData("--to|a@example.test")]
    [InlineData("--to|a@example.test|--kind|password")]
    [InlineData("--to|<empty>|--kind|code")]
    [InlineData("--to|a@example.test|--kind|code|--connection|Server=x")]
    [InlineData("--to|a@example.test|--to|b@example.test")]
    public async Task AMissingOrUnknownArgumentIsAUsageError(string joined)
    {
        string[] args = joined.Length == 0 ? [] : [.. joined.Split('|').Select(part => part == "<empty>" ? string.Empty : part)];
        var stdout = new StringWriter();
        var stderr = new StringWriter();

        var exit = await RunAsync(args, stdout, stderr);

        exit.ShouldBe(64);
        stderr.ToString().ShouldStartWith("Usage:");
        stdout.ToString().ShouldBeEmpty();
    }

    [Fact]
    public async Task ARunWithoutTheConnectionVariableIsAUsageError()
    {
        var stdout = new StringWriter();
        var stderr = new StringWriter();

        var exit = await Program.RunAsync(
            ["--to", "a@example.test", "--kind", "invite"], name => name == "GITHUB_ACTIONS" ? "true" : null, stdout, stderr, TestContext.Current.CancellationToken);

        exit.ShouldBe(64);
        stderr.ToString().ShouldContain("CSPS_CI_MAILBOX_CONNECTION");
        stdout.ToString().ShouldBeEmpty();
    }

    // The text part of an invite email, copied from EmailRenderer and EmailHtmlLayout (the renderer is internal to Csps.Infrastructure).
    private static string InviteText(string linkToken) =>
        "You're invited\n\nA staff account was set up for a@example.test. Set your password to start using CSPS Admin.\n\n"
        + $"Set Your Password: https://csps.example.test/admin/accept-invite#token={linkToken}\n\nCSPS footer\n";

    private static Task<int> RunAsync(string[] args, StringWriter stdout, StringWriter stderr) =>
        Program.RunAsync(args, name => name == "GITHUB_ACTIONS" ? "true" : "Server=127.0.0.1,1433;Database=CSPS_Zap;User ID=sa;Password=NotARealSecret1", stdout, stderr, TestContext.Current.CancellationToken);

    private async Task CloseAsync(string to)
    {
        await using var context = database.CreateContext();
        foreach (var row in await context.EmailOutbox.Where(message => message.ToAddress == to).ToListAsync(TestContext.Current.CancellationToken))
        {
            row.MarkSent(Noon);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static string Address() => $"{Guid.NewGuid():N}@example.test";

    private static IDataProtector Protector() =>
        new EphemeralDataProtectionProvider().CreateProtector(OutboxReader.ProtectionPurpose);

    private static IConfiguration Settings() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
                [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
            })
            .Build();

    private async Task<string?> Read(IDataProtector protector, string to, AuthEmailKind kind)
    {
        await using var context = database.CreateContext();
        return await OutboxReader.ReadNewestAsync(context, protector, to, kind, TestContext.Current.CancellationToken);
    }

    private async Task QueueAsync(IDataProtector protector, string to, AuthEmailKind kind, string text, DateTimeOffset createdAt, Guid? id = null)
    {
        await using var context = database.CreateContext();
        await QueueAsync(context, protector, to, kind, text, createdAt, id);
    }

    private static async Task QueueAsync(CspsDbContext context, IDataProtector protector, string to, AuthEmailKind kind, string text, DateTimeOffset createdAt, Guid? id)
    {
        context.EmailOutbox.Add(EmailOutboxMessage.Queue(
            id ?? Guid.CreateVersion7(createdAt),
            kind,
            to,
            protector.Protect("subject"),
            protector.Protect(text),
            protector.Protect("<p>html</p>"),
            createdAt,
            createdAt.AddDays(1)));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
