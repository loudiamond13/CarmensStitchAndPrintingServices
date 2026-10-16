using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Csps.Infrastructure.Identity;
using Csps.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// AUTH-02, AUTH-03: the code key is required and never printed, the MAC binds a code to its challenge and account,
/// and codes and tokens have the promised shape. Nothing here opens a database.
/// </summary>
public sealed partial class AuthSecretsTests
{
    private const string Code = "012345";
    private static readonly Guid ChallengeId = Guid.Parse("0199c7a0-1111-7000-8000-000000000001");
    private static readonly Guid UserId = Guid.Parse("0199c7a0-2222-7000-8000-000000000002");

    [Fact]
    public async Task HostWithoutTheCodeKeyStopsAtStartNamingTheSetting()
    {
        using var host = BuildHost(key: null);

        var failure = await Should.ThrowAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        failure.Message.ShouldContain("Auth:CodeMacKey");
    }

    [Fact]
    public async Task HostWithANonBase64KeyStopsAtStartWithoutPrintingIt()
    {
        const string Value = "%%not-base64-at-all-but-long-enough-to-spot%%";
        using var host = BuildHost(Value);

        var failure = await Should.ThrowAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        failure.Message.ShouldContain("Auth:CodeMacKey");
        failure.Message.ShouldNotContain(Value);
    }

    [Fact]
    public async Task HostWithA31ByteKeyStopsAtStartWithoutPrintingIt()
    {
        var value = Convert.ToBase64String(new byte[31].Select(static (_, index) => (byte)(index + 1)).ToArray());
        using var host = BuildHost(value);

        var failure = await Should.ThrowAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        failure.Message.ShouldContain("Auth:CodeMacKey");
        failure.Message.ShouldNotContain(value);
    }

    [Fact]
    public async Task HostWithA32ByteKeyStarts()
    {
        using var host = BuildHost(Convert.ToBase64String(new byte[32].Select(static (_, index) => (byte)(index + 1)).ToArray()));

        await host.StartAsync(TestContext.Current.CancellationToken);
        await host.StopAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public void MacIs32BytesAndDeterministic()
    {
        var mac = NewMac(TestSecrets.CodeMacKeyBase64);

        var first = mac.Compute(ChallengeId, UserId, Code);

        first.Length.ShouldBe(32);
        mac.Compute(ChallengeId, UserId, Code).ShouldBe(first);
    }

    [Fact]
    public void MacIsHmacSha256OverChallengeIdUserIdAndTheAsciiDigits()
    {
        var key = Convert.FromBase64String(TestSecrets.CodeMacKeyBase64);
        var input = new List<byte>();
        input.AddRange(ChallengeId.ToByteArray(bigEndian: true));
        input.AddRange(UserId.ToByteArray(bigEndian: true));
        input.AddRange(Encoding.ASCII.GetBytes(Code));

        NewMac(TestSecrets.CodeMacKeyBase64).Compute(ChallengeId, UserId, Code).ShouldBe(HMACSHA256.HashData(key, input.ToArray()));
    }

    [Fact]
    public void MacChangesWithTheChallengeTheUserTheCodeAndTheKey()
    {
        var mac = NewMac(TestSecrets.CodeMacKeyBase64);
        var baseline = mac.Compute(ChallengeId, UserId, Code);

        mac.Compute(Guid.Parse("0199c7a0-1111-7000-8000-000000000003"), UserId, Code).ShouldNotBe(baseline);
        mac.Compute(ChallengeId, Guid.Parse("0199c7a0-2222-7000-8000-000000000004"), Code).ShouldNotBe(baseline);
        mac.Compute(ChallengeId, UserId, "012346").ShouldNotBe(baseline);
        NewMac(Convert.ToBase64String(SHA384.HashData(Encoding.UTF8.GetBytes("another key")))).Compute(ChallengeId, UserId, Code).ShouldNotBe(baseline);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12a456")]
    [InlineData("12 456")]
    [InlineData("")]
    [InlineData(null)]
    public void MalformedCodesAreRefusedWithoutEchoingThem(string? code)
    {
        var failure = Should.Throw<ArgumentException>(() => NewMac(TestSecrets.CodeMacKeyBase64).Compute(ChallengeId, UserId, code!));

        if (!string.IsNullOrEmpty(code))
        {
            failure.Message.ShouldNotContain(code);
        }
    }

    [Fact]
    public void ComputingWithAnInvalidKeyFailsWithTheSettingNameAndNotTheValue()
    {
        const string Value = "short-key";
        var mac = NewMac(Value);

        var failure = Should.Throw<InvalidOperationException>(() => mac.Compute(ChallengeId, UserId, Code));

        failure.Message.ShouldContain("Auth:CodeMacKey");
        failure.Message.ShouldNotContain(Value);
    }

    [Fact]
    public void CodesAreSixAsciiDigitsWithLeadingZerosKept()
    {
        var random = new SecureRandom();

        var codes = Enumerable.Range(0, 1_000).Select(_ => random.NewSixDigitCode()).ToList();

        codes.ShouldAllBe(code => SixDigits().IsMatch(code));
        codes.ShouldContain(code => code.StartsWith('0'));
    }

    [Fact]
    public void TokensAre43Base64UrlCharactersOf32BytesAndDistinct()
    {
        var random = new SecureRandom();

        var tokens = Enumerable.Range(0, 1_000).Select(_ => random.NewToken()).ToList();

        tokens.ShouldAllBe(token => token.Length == 43 && Base64Url().IsMatch(token));
        tokens.ShouldAllBe(token => WebEncoders.Base64UrlDecode(token).Length == 32);
        tokens.Distinct(StringComparer.Ordinal).Count().ShouldBe(1_000);
    }

    [GeneratedRegex("^[0-9]{6}$")]
    private static partial Regex SixDigits();

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex Base64Url();

    private static HmacCodeMac NewMac(string key) => new(Options.Create(new AuthSecretsOptions { CodeMacKey = key }));

    // No database is opened: persistence is registered for Identity, and nothing connects at start.
    private static IHost BuildHost(string? key)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { DisableDefaults = true });
        if (key is not null)
        {
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { [TestSecrets.CodeMacKeySetting] = key });
        }

        builder.Services.AddCspsPersistence("Server=(localdb)\\MSSQLLocalDB;Database=CSPS_Test_00000000-0000-0000-0000-000000000000");
        builder.Services.AddCspsIdentity();
        return builder.Build();
    }
}
