using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// SEC-05, CWE Top 25 (2025) memory-safety rows (787, 416, 125, 120, 476, 121, 122) and the code-execution rows
/// (78, 94, 502, 918): .NET and JavaScript are memory-safe runtimes, so these rows hold only while the code never
/// switches that safety off, never starts an operating system process, never builds code at run time, never uses an
/// unsafe deserializer and only calls the outside hosts it is meant to call. Each scan reads code lines only, so a
/// comment or a string may name the banned word.
/// </summary>
public sealed partial class NoUnsafeCodeTests
{
    private static readonly string[] CodeRoots = ["src", "tools"];

    private static readonly string[] ProcessTokens = ["Process.Start", "ProcessStartInfo", "new Process("];

    private static readonly string[] DynamicCodeTokens =
    [
        "Assembly.Load",
        "Assembly.UnsafeLoadFrom",
        "CSharpScript",
        "CSharpCompilation",
        "System.Reflection.Emit",
        "AssemblyBuilder",
        "DynamicMethod",
    ];

    private static readonly string[] UnsafeDeserializerTokens =
    [
        "BinaryFormatter",
        "SoapFormatter",
        "NetDataContractSerializer",
        "LosFormatter",
        "ObjectStateFormatter",
        "JavaScriptSerializer",
        "TypeNameHandling",
    ];

    private static readonly string[] OutboundTokens =
    [
        "HttpClient",
        "IHttpClientFactory",
        "HttpRequestMessage",
        "WebClient",
        "WebRequest",
        "TcpClient",
        "UdpClient",
        "new Socket(",
        "SocketsHttpHandler",
        "DelegatingHandler",
        "Dns.",
        "SmtpClient",
        "ImapClient",
        "Pop3Client",
        "RestClient",
    ];

    // The only files that reach an outside host: the Cloudinary photo store and its setup tool, the breached
    // password range lookup, and the mail sender (the mail host from settings). Each has a fixed address from
    // settings or code, never one a visitor supplies.
    private static readonly string[] OutboundAllowList =
    [
        "src/Csps.Infrastructure/Email/MailKitTransport.cs",
        "src/Csps.Infrastructure/Images/CloudinaryImageStorage.cs",
        "src/Csps.Infrastructure/Images/CloudinarySetupCommand.cs",
        "src/Csps.Infrastructure/Images/ImagesRegistration.cs",
        "src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs",
        "src/Csps.Infrastructure/Passwords/PasswordCheckRegistration.cs",
        "tools/Csps.CloudinarySetup/Program.cs",
    ];

    [Fact]
    public void NoSourceFileUsesTheUnsafeKeyword() =>
        Offenders(CodeRoots, "*.cs", UnsafeOffence)
            .ShouldBeEmpty("No C# file under src or tools may use the unsafe keyword (CWE-787, 416, 125, 120, 476, 121, 122).");

    [Fact]
    public void NoProjectAllowsUnsafeBlocks()
    {
        var offenders = new List<string>();
        foreach (var file in BuildFiles())
        {
            if (AllowsUnsafeBlocks(File.ReadAllText(file)))
            {
                offenders.Add(Relative(file));
            }
        }

        offenders.ShouldBeEmpty("No project may set AllowUnsafeBlocks to true.");
    }

    [Theory]
    [InlineData("unsafe { }")]
    [InlineData("    public unsafe void Copy(byte* source) { }")]
    [InlineData("internal unsafe struct Packet { }")]
    public void TheUnsafeScannerCatchesEachSample(string line) => UnsafeKeyword().IsMatch(CodeOnly(line)).ShouldBeTrue();

    [Theory]
    [InlineData("    // this unsafe value stops the host")]
    [InlineData("    /// Nothing is added for scripts. No unsafe-inline, no unsafe-eval.")]
    [InlineData("     * unsafe is banned")]
    [InlineData("var policy = \"script-src 'self' 'unsafe-inline'\";")]
    [InlineData("var count = 1; // not unsafe")]
    [InlineData("System.Runtime.CompilerServices.Unsafe.As<byte, int>(ref value);")]
    public void TheUnsafeScannerIgnoresCommentsStringsAndTheUnsafeClass(string line) =>
        UnsafeKeyword().IsMatch(CodeOnly(line)).ShouldBeFalse();

    [Theory]
    [InlineData("<AllowUnsafeBlocks>true</AllowUnsafeBlocks>")]
    [InlineData("  <AllowUnsafeBlocks> True </AllowUnsafeBlocks>")]
    [InlineData("<AllowUnsafeBlocks Condition=\"'$(Configuration)' == 'Release'\">true</AllowUnsafeBlocks>")]
    [InlineData("<!-- a note --> <AllowUnsafeBlocks>true</AllowUnsafeBlocks>")]
    [InlineData("<!-- a note\nover two lines -->\n<AllowUnsafeBlocks>true</AllowUnsafeBlocks>")]
    public void TheProjectScannerCatchesTheSetting(string text) => AllowsUnsafeBlocks(text).ShouldBeTrue();

    [Theory]
    [InlineData("<AllowUnsafeBlocks>false</AllowUnsafeBlocks>")]
    [InlineData("<!-- <AllowUnsafeBlocks>true</AllowUnsafeBlocks> -->")]
    [InlineData("<!--\n<AllowUnsafeBlocks>true</AllowUnsafeBlocks>\n-->")]
    [InlineData("<AllowUnsafeBlocks Condition=\"false\">false</AllowUnsafeBlocks>")]
    [InlineData("<Nullable>enable</Nullable>")]
    public void TheProjectScannerIgnoresOtherText(string text) => AllowsUnsafeBlocks(text).ShouldBeFalse();

    [Fact]
    public void NoSourceFileStartsAnOperatingSystemProcess() =>
        Offenders(CodeRoots, "*.cs", line => TokensIn(line, ProcessTokens))
            .ShouldBeEmpty("No code under src or tools may start an operating system process (CWE-78, CWE-77).");

    [Fact]
    public void NoSourceFileLoadsOrBuildsCodeAtRunTime() =>
        Offenders(CodeRoots, "*.cs", line => TokensIn(line, DynamicCodeTokens))
            .ShouldBeEmpty("No code under src or tools may load or build code at run time (CWE-94).");

    [Fact]
    public void NoSourceFileUsesAnUnsafeDeserializer() =>
        Offenders(CodeRoots, "*.cs", line => TokensIn(line, UnsafeDeserializerTokens))
            .ShouldBeEmpty("Only System.Text.Json is used, with no type names in the payload (CWE-502).");

    [Fact]
    public void OnlyTheAllowListedFilesMakeOutboundHttpRequests()
    {
        var offenders = Offenders(CodeRoots, "*.cs", line => TokensIn(line, OutboundTokens))
            .Where(offence => !OutboundAllowList.Any(allowed => offence.StartsWith(allowed + ": ", StringComparison.Ordinal)))
            .ToList();

        offenders.ShouldBeEmpty("Outbound calls go only to the fixed hosts in the allow list, never to a visitor-supplied address (CWE-918).");
    }

    [Fact]
    public void EveryAllowListedOutboundFileExists() =>
        OutboundAllowList
            .Where(path => !File.Exists(RepoRoot.PathOf(path)))
            .ShouldBeEmpty("A moved or deleted file must also leave the outbound allow list.");

    [Theory]
    [InlineData("using var process = Process.Start(info);", true)]
    [InlineData("var info = new ProcessStartInfo(\"cmd\");", true)]
    [InlineData("var bytes = new BinaryFormatter();", true)]
    [InlineData("var assembly = Assembly.LoadFrom(path);", true)]
    [InlineData("var http = new HttpClient();", true)]
    [InlineData("var handler = new SocketsHttpHandler();", true)]
    [InlineData("var handler = new HttpClientHandler();", true)]
    [InlineData("public sealed class Hook : DelegatingHandler { }", true)]
    [InlineData("var socket = new Socket(family, type, protocol);", true)]
    [InlineData("using var udp = new UdpClient();", true)]
    [InlineData("var host = Dns.GetHostEntry(name);", true)]
    [InlineData("using var client = new SmtpClient();", true)]
    [InlineData("using var client = new ImapClient();", true)]
    [InlineData("var rest = new RestClient(address);", true)]
    [InlineData("using System.Net.Sockets;", false)]
    [InlineData("SmtpSecurity.StartTls => SecureSocketOptions.StartTls,", false)]
    [InlineData("SocketException or IOException => \"smtp-connect\",", false)]
    [InlineData("    // Process.Start is banned", false)]
    [InlineData("var text = \"BinaryFormatter\";", false)]
    [InlineData("var processor = new ProcessorOptions();", false)]
    public void TheTokenScannerCatchesCodeAndIgnoresCommentsAndStrings(string line, bool flagged)
    {
        string[] all = [.. ProcessTokens, .. DynamicCodeTokens, .. UnsafeDeserializerTokens, .. OutboundTokens];
        TokensIn(line, all).Any().ShouldBe(flagged);
    }

    [Fact]
    public void NoWebSourceEvaluatesAString()
    {
        var root = RepoRoot.PathOf("web/src");
        var offenders = new List<string>();
        foreach (var file in Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
                     .Where(IsWebSourceFile))
        {
            var relative = Relative(file);
            offenders.AddRange(File.ReadLines(file)
                .Where(line => StringEvaluation().IsMatch(CodeOnly(line)))
                .Select(line => $"{relative}: {line.Trim()}"));
        }

        offenders.ShouldBeEmpty("Browser code must not run text as code (CWE-94).");
    }

    [Theory]
    [InlineData("const value = eval(text);", true)]
    [InlineData("const run = new Function('a', 'return a');", true)]
    [InlineData("document.write(markup);", true)]
    [InlineData("// never call eval(text)", false)]
    [InlineData("const note = 'eval(x) is banned';", false)]
    [InlineData("const total = retrieval(1);", false)]
    public void TheWebScannerCatchesEachSampleAndIgnoresCommentsAndStrings(string line, bool flagged) =>
        StringEvaluation().IsMatch(CodeOnly(line)).ShouldBe(flagged);

    // Lines that are only a comment are blank. Strings and trailing comments are cut so the banned word may be named.
    private static string CodeOnly(string line)
    {
        var trimmed = line.TrimStart();
        if (trimmed.StartsWith("//", StringComparison.Ordinal)
            || trimmed.StartsWith("/*", StringComparison.Ordinal)
            || trimmed.StartsWith('*'))
        {
            return string.Empty;
        }

        var withoutStrings = QuotedText().Replace(line, "\"\"");
        var comment = withoutStrings.IndexOf("//", StringComparison.Ordinal);
        return comment < 0 ? withoutStrings : withoutStrings[..comment];
    }

    private static IEnumerable<string> UnsafeOffence(string line) =>
        UnsafeKeyword().IsMatch(CodeOnly(line)) ? new[] { line.Trim() } : [];

    private static IEnumerable<string> TokensIn(string line, string[] tokens)
    {
        var code = CodeOnly(line);
        return tokens.Where(token => code.Contains(token, StringComparison.Ordinal));
    }

    // Each offence is "relative/path.cs: text" so a caller can match a path prefix.
    private static List<string> Offenders(string[] roots, string pattern, Func<string, IEnumerable<string>> scan)
    {
        var offenders = new List<string>();
        foreach (var root in roots)
        {
            foreach (var file in EnumerateOutsideBuildFolders(RepoRoot.PathOf(root), pattern))
            {
                var relative = Relative(file);
                offenders.AddRange(File.ReadLines(file).SelectMany(scan).Select(offence => $"{relative}: {offence}"));
            }
        }

        return offenders;
    }

    private static IEnumerable<string> BuildFiles()
    {
        foreach (var root in new[] { "src", "tools", "tests" })
        {
            foreach (var pattern in new[] { "*.csproj", "*.props", "*.targets" })
            {
                foreach (var file in EnumerateOutsideBuildFolders(RepoRoot.PathOf(root), pattern))
                {
                    yield return file;
                }
            }
        }

        foreach (var name in new[] { "Directory.Build.props", "Directory.Build.targets", "Directory.Packages.props" })
        {
            var path = RepoRoot.PathOf(name);
            if (File.Exists(path))
            {
                yield return path;
            }
        }
    }

    private static IEnumerable<string> EnumerateOutsideBuildFolders(string root, string pattern) =>
        Directory.EnumerateFiles(root, pattern, SearchOption.AllDirectories)
            .Where(file => !Segments(file).Any(segment =>
                segment.Equals("bin", StringComparison.OrdinalIgnoreCase)
                || segment.Equals("obj", StringComparison.OrdinalIgnoreCase)
                || segment.Equals("node_modules", StringComparison.OrdinalIgnoreCase)));

    private static bool IsWebSourceFile(string file)
    {
        var name = Path.GetFileName(file);
        var isScript = name.EndsWith(".ts", StringComparison.Ordinal) || name.EndsWith(".tsx", StringComparison.Ordinal);
        var isTest = name.Contains(".test.", StringComparison.Ordinal) || Segments(file).Contains("test", StringComparer.Ordinal);
        return isScript && !isTest;
    }

    private static string[] Segments(string path) => path.Split('/', '\\');

    private static string Relative(string file) =>
        Path.GetRelativePath(RepoRoot.Find(), file).Replace('\\', '/');

    [GeneratedRegex(@"\bunsafe\b", RegexOptions.CultureInvariant)]
    private static partial Regex UnsafeKeyword();

    // Comments are removed first, then the element is matched with or without attributes such as Condition.
    private static bool AllowsUnsafeBlocks(string xml) => AllowUnsafeBlocksTrue().IsMatch(XmlComment().Replace(xml, string.Empty));

    [GeneratedRegex(@"<AllowUnsafeBlocks(\s[^>]*)?>\s*true\s*</AllowUnsafeBlocks>", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex AllowUnsafeBlocksTrue();

    [GeneratedRegex(@"<!--.*?-->", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex XmlComment();

    [GeneratedRegex(@"""(?:\\.|[^""\\])*""|'(?:\\.|[^'\\])*'", RegexOptions.CultureInvariant)]
    private static partial Regex QuotedText();

    [GeneratedRegex(@"(?<![\w.])eval\s*\(|\bnew\s+Function\s*\(|\bdocument\.write\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex StringEvaluation();
}
