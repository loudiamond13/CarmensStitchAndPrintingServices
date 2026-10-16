using System.Text.Json;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// D-26, D-27, QUAL-05: guards on how mail can leave the app. SMTP secrets never sit in a file in git, the transport
/// cannot fall back to plain text or skip certificate checks, and the Testing sink is compiled into Debug builds only.
/// </summary>
public sealed partial class MailSafetyTests
{
    [Fact]
    public void NoAppsettingsFileHoldsSmtpSettings()
    {
        var files = Directory.GetFiles(RepoRoot.PathOf("src/Csps.Server"), "appsettings*.json");
        files.ShouldNotBeEmpty();

        foreach (var file in files)
        {
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            document.RootElement.TryGetProperty("Smtp", out _).ShouldBeFalse($"{Path.GetFileName(file)} must not hold SMTP settings (they come from user-secrets or host settings).");
        }
    }

    [Fact]
    public void TransportNeverWeakensTls()
    {
        var code = CodeWithoutComments(File.ReadAllText(RepoRoot.PathOf("src/Csps.Infrastructure/Email/MailKitTransport.cs")));

        code.ShouldNotContain("ServerCertificateValidationCallback");
        code.ShouldNotContain("CheckCertificateRevocation = false");
        code.ShouldNotContain("SecureSocketOptions.None");
        code.ShouldNotContain("SecureSocketOptions.Auto");
        code.ShouldNotContain("StartTlsWhenAvailable");
        code.ShouldContain("SecureSocketOptions.StartTls");
        code.ShouldContain("SecureSocketOptions.SslOnConnect");
    }

    [Fact]
    public void TestingSinkSymbolIsDefinedForDebugBuildsOnly()
    {
        var project = File.ReadAllText(RepoRoot.PathOf("src/Csps.Infrastructure/Csps.Infrastructure.csproj"));

        DefineConstantsBlock().Matches(project).Count(match => match.Value.Contains("CSPS_TESTING", StringComparison.Ordinal))
            .ShouldBe(1, "CSPS_TESTING must be defined exactly once.");
        project.ShouldContain("Condition=\"'$(Configuration)' == 'Debug'\"");

        var group = DebugPropertyGroup().Match(project);
        group.Success.ShouldBeTrue("CSPS_TESTING must sit inside a PropertyGroup conditioned on the Debug configuration.");
        group.Value.ShouldContain("CSPS_TESTING");

        var sink = File.ReadAllText(RepoRoot.PathOf("src/Csps.Infrastructure/Email/InMemoryEmailSink.cs"));
        sink.ShouldStartWith("#if CSPS_TESTING");
        sink.TrimEnd().ShouldEndWith("#endif");
    }

    private static string CodeWithoutComments(string source) =>
        string.Join('\n', source.Split('\n').Where(line => !line.TrimStart().StartsWith("//", StringComparison.Ordinal)));

    [GeneratedRegex(@"<DefineConstants>[^<]*</DefineConstants>")]
    private static partial Regex DefineConstantsBlock();

    [GeneratedRegex(@"<PropertyGroup Condition=""'\$\(Configuration\)' == 'Debug'"">.*?</PropertyGroup>", RegexOptions.Singleline)]
    private static partial Regex DebugPropertyGroup();
}
