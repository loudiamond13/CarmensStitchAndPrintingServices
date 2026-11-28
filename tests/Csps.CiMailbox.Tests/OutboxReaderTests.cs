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
