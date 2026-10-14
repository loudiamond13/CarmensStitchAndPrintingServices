using System.Text.RegularExpressions;
using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnitV3;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace Csps.ArchitectureTests;

/// <summary>
/// Research Pitfall 17 and threat T-01-25: client addresses come from the direct connection only. Nothing under
/// <c>src/</c> may turn on forwarded-headers processing or read proxy headers until the FND-13 hosting record
/// proves which proxy sits in front of the site; until then a client could forge its own address.
/// </summary>
public sealed partial class ForwardedHeadersTests
{
    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(typeof(Program).Assembly)
        .Build();

    private static readonly string[] IgnoredDirectoryNames = ["bin", "obj"];
    private static readonly string[] ScannedExtensions = [".cs", ".json", ".config"];

    [Fact]
    public void NoForwardedHeadersMiddlewareYet()
    {
        var sourceRoot = RepoRoot.PathOf("src");
        var offenders = new List<string>();

        foreach (var file in SourceFiles(sourceRoot))
        {
            var relative = Path.GetRelativePath(sourceRoot, file);
            offenders.AddRange(Offences(File.ReadAllText(file)).Select(offence => $"{relative}: {offence}"));
        }

        offenders.ShouldBeEmpty("Forwarded headers stay off until FND-13 proves the proxy topology (Pitfall 17).");
    }

    [Fact]
    public void ServerDoesNotReferenceForwardedHeadersTypes()
    {
        IArchRule rule = Types().That().ResideInAssembly(typeof(Program).Assembly).Should()
            .NotDependOnAnyTypesThat()
            .HaveFullNameMatching(@"(^Microsoft\.AspNetCore\.HttpOverrides\.|ForwardedHeaders)");

        rule.Check(Architecture);
    }

    [Theory]
    [InlineData("app.UseForwardedHeaders();")]
    [InlineData("services.Configure<ForwardedHeadersOptions>(o => { });")]
    [InlineData("o.ForwardedHeaders = ForwardedHeaders.XForwardedFor;")]
    [InlineData("\"ASPNETCORE_FORWARDEDHEADERS_ENABLED\": \"true\"")]
    [InlineData("var ip = context.Request.Headers[\"X-Forwarded-For\"];")]
    [InlineData("var ip = context.Request.Headers[\"x-real-ip\"];")]
    [InlineData("var ip = context.Request.Headers[\"CF-Connecting-IP\"];")]
    public void DetectorCatchesForwardedHeaderUse(string source) => Offences(source).ShouldNotBeEmpty();

    [Theory]
    [InlineData("/// Proxy headers such as <c>X-Forwarded-For</c> are ignored.")]
    [InlineData("var ip = context.Connection.RemoteIpAddress;")]
    public void DetectorAllowsDocumentationAndTheConnectionAddress(string source) => Offences(source).ShouldBeEmpty();

    private static IEnumerable<string> Offences(string text) =>
        ForwardedHeadersSetup().Matches(text).Concat(ProxyHeaderLiteral().Matches(text)).Select(static match => match.Value);

    private static List<string> SourceFiles(string directory)
    {
        var files = Directory.EnumerateFiles(directory)
            .Where(file => ScannedExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
            .ToList();
        foreach (var child in Directory.EnumerateDirectories(directory))
        {
            if (!IgnoredDirectoryNames.Contains(Path.GetFileName(child), StringComparer.OrdinalIgnoreCase))
            {
                files.AddRange(SourceFiles(child));
            }
        }

        return files;
    }

    // The middleware, its options, the ForwardedHeaders enum and the environment switch that enables it.
    [GeneratedRegex(@"\bUseForwardedHeaders\b|\bForwardedHeadersOptions\b|\bForwardedHeaders\.|FORWARDEDHEADERS_ENABLED", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ForwardedHeadersSetup();

    // A proxy header named in a string literal, which is how code reads it; documentation is not quoted.
    [GeneratedRegex("\"(X-Forwarded-For|X-Forwarded-Proto|X-Forwarded-Host|X-Real-IP|CF-Connecting-IP|Forwarded)\"", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ProxyHeaderLiteral();
}
