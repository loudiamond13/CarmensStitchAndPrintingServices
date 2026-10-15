using System.Text.Json.Nodes;

namespace Csps.ArchitectureTests;

/// <summary>Dependency registry rules (QUAL-06, D-00, D-18, D-19).</summary>
public sealed class DependencyRegistryTests
{
    private static readonly PackagePin AlphaPin = new("Alpha.Package", "1.2.3", "PackageVersion");
    private static readonly PackagePin BetaPin = new("beta-tool", "4.5.6", "tool");
    private static readonly PackagePin[] SamplePins = [AlphaPin, BetaPin];

    private static readonly PackagePin[] NpmPins =
    [
        new("tools/openapi-gen:typescript", "5.9.3", "npm"),
        new("web:typescript", "7.0.2", "npm"),
        new("web:vite", "8.3.3", "npm"),
    ];

    [Fact]
    public void RepositoryRegistryCoversEveryPinWithACompleteEntry()
    {
        var path = RepoRoot.PathOf(DependencyRegistry.RegistryPath);
        var json = File.Exists(path) ? File.ReadAllText(path) : null;

        var problems = DependencyRegistry.Validate(json, PackagePins.ReadAll());

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void SampleRegistryIsValid()
    {
        DependencyRegistry.Validate(Registry().ToJsonString(), SamplePins).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingOrEmptyRegistryFails(string? json)
    {
        var problems = DependencyRegistry.Validate(json, SamplePins);

        problems.ShouldHaveSingleItem().ShouldContain("missing or empty");
    }

    [Fact]
    public void RegistryWithoutPackagesFails()
    {
        var registry = Registry();
        registry["packages"] = new JsonArray();

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins).ShouldContain(problem => problem.Contains("lists no packages", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("purpose")]
    [InlineData("license")]
    [InlineData("publisher")]
    [InlineData("legitimacy")]
    public void EntryWithAnEmptyRequiredFieldFails(string field)
    {
        var registry = Registry();
        Entries(registry)[0]![field] = " ";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains($"{field} is empty", StringComparison.Ordinal));
    }

    [Fact]
    public void ExactlyFourteenDaysCountsAsAged()
    {
        var registry = Registry();
        Entries(registry)[0]!["published"] = "2026-09-23";
        Entries(registry)[0]!["adopted"] = "2026-10-07";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins).ShouldBeEmpty();
    }

    [Fact]
    public void ThirteenDaysIsNotAged()
    {
        var registry = Registry();
        Entries(registry)[0]!["published"] = "2026-09-24";
        Entries(registry)[0]!["adopted"] = "2026-10-07";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("adopted 13 days after release", StringComparison.Ordinal));
    }

    [Fact]
    public void AcceptedCoolDownWithAReasonIsValid()
    {
        var registry = Registry();
        Entries(registry)[0]!["published"] = "2026-10-06";
        Entries(registry)[0]!["coolDown"] = "accepted: security fix for a published advisory";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("accepted:")]
    [InlineData("accepted:   ")]
    [InlineData("fresh")]
    [InlineData("")]
    public void CoolDownWithoutAgedOrAReasonFails(string coolDown)
    {
        var registry = Registry();
        Entries(registry)[0]!["coolDown"] = coolDown;

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins).ShouldNotBeEmpty();
    }

    [Theory]
    [InlineData("2026/09/01")]
    [InlineData("01-09-2026")]
    [InlineData("")]
    public void PublishedDateMustBeIsoFormatted(string published)
    {
        var registry = Registry();
        Entries(registry)[0]!["published"] = published;

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("published", StringComparison.Ordinal));
    }

    [Fact]
    public void UnsortedEntriesFail()
    {
        var registry = Registry();
        var entries = Entries(registry);
        var first = entries[0]!.DeepClone();
        entries.RemoveAt(0);
        entries.Add(first);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("must be sorted", StringComparison.Ordinal));
    }

    [Fact]
    public void DuplicateIdsFail()
    {
        var registry = Registry();
        var entries = Entries(registry);
        var duplicate = entries[0]!.DeepClone();
        duplicate["id"] = "ALPHA.PACKAGE";
        entries.Insert(1, duplicate);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("duplicate", StringComparison.Ordinal));
    }

    [Fact]
    public void PinWithoutAnEntryFails()
    {
        PackagePin[] pins = [.. SamplePins, new PackagePin("Gamma.Package", "7.0.0", "PackageVersion")];

        DependencyRegistry.Validate(Registry().ToJsonString(), pins)
            .ShouldContain(problem => problem.Contains("Gamma.Package 7.0.0 (PackageVersion) has no registry entry", StringComparison.Ordinal));
    }

    [Fact]
    public void PinnedVersionThatDiffersFromTheRegistryFails()
    {
        PackagePin[] pins = [AlphaPin with { Version = "1.2.4" }, BetaPin];

        DependencyRegistry.Validate(Registry().ToJsonString(), pins)
            .ShouldContain(problem => problem.Contains("pinned at 1.2.4 but the registry records 1.2.3", StringComparison.Ordinal));
    }

    [Fact]
    public void StaleEntryWithoutAPinFails()
    {
        DependencyRegistry.Validate(Registry().ToJsonString(), [AlphaPin])
            .ShouldContain(problem => problem.Contains("beta-tool: registry entry has no matching pin", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("GPL-3.0-only")]
    [InlineData("AGPL-3.0")]
    [InlineData("SSPL-1.0")]
    [InlineData("Proprietary")]
    public void LicenseOutsideTheAllowListFails(string license)
    {
        var registry = Registry();
        Entries(registry)[0]!["license"] = license;

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("is not allowed", StringComparison.Ordinal));
    }

    [Fact]
    public void ExceptionLicenseIsAllowedInsideItsScope()
    {
        var registry = Registry();
        Entries(registry)[0]!["license"] = "MPL-2.0";
        Entries(registry)[0]!["scope"] = "test";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins).ShouldBeEmpty();
    }

    [Fact]
    public void ExceptionLicenseOutsideItsScopeFails()
    {
        var registry = Registry();
        Entries(registry)[0]!["license"] = "MPL-2.0";
        Entries(registry)[0]!["scope"] = "runtime";

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("allowed only for scope 'test'", StringComparison.Ordinal));
    }

    [Fact]
    public void ReadAllIncludesThePinsOfBothNpmManifests()
    {
        var pins = PackagePins.ReadAll();

        pins.ShouldContain(pin => pin.Id == "web:vite" && pin.Source == PackagePins.NpmSource);
        pins.ShouldContain(pin => pin.Id == "tools/openapi-gen:openapi-typescript" && pin.Source == PackagePins.NpmSource);
    }

    [Fact]
    public void ReadNpmManifestReadsDependenciesAndDevDependenciesAsExactPins()
    {
        const string json = """{ "dependencies": { "react": "19.3.0" }, "devDependencies": { "vite": "8.3.3" } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe(
            [new PackagePin("web:react", "19.3.0", "npm"), new PackagePin("web:vite", "8.3.3", "npm")],
            ignoreOrder: true);
    }

    [Theory]
    [InlineData("typescript", "npm:@typescript/typescript6@6.0.2", "web:@typescript/typescript6", "6.0.2")]
    [InlineData("@typescript/native", "npm:typescript@7.0.2", "web:typescript", "7.0.2")]
    public void ReadNpmManifestResolvesAnAliasToTheRealPackageAndVersion(string name, string spec, string id, string version)
    {
        var json = $$"""{ "devDependencies": { "{{name}}": "{{spec}}" } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe([new PackagePin(id, version, "npm")]);
    }

    [Fact]
    public void ReadNpmManifestReadsOverridesAsPins()
    {
        const string json = """{ "overrides": { "source-map-js": "1.2.2", "http-cache-semantics": "4.3.0" } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe(
            [new PackagePin("web:source-map-js", "1.2.2", "npm"), new PackagePin("web:http-cache-semantics", "4.3.0", "npm")],
            ignoreOrder: true);
    }

    // npm 7+ installs peerDependencies automatically and optionalDependencies by default, so they are pins too
    // (NET-WR-05).
    [Theory]
    [InlineData("optionalDependencies")]
    [InlineData("peerDependencies")]
    public void ReadNpmManifestReadsOptionalAndPeerDependenciesAsPins(string section)
    {
        var json = $$"""{ "{{section}}": { "fsevents": "2.3.3" } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe([new PackagePin("web:fsevents", "2.3.3", "npm")]);
    }

    [Fact]
    public void AnOptionalDependencyWithoutAnEntryFailsNamingIt()
    {
        const string json = """{ "optionalDependencies": { "fsevents": "2.3.3" } }""";

        DependencyRegistry.Validate(Registry().ToJsonString(), [.. SamplePins, .. PackagePins.ReadNpmManifest(json, "web")])
            .ShouldContain(problem => problem.Contains("web:fsevents 2.3.3 (npm) has no registry entry", StringComparison.Ordinal));
    }

    // A bundled name takes its version from the section that installs it; a bundled name no section pins still
    // becomes a pin (with no version), so it can never skip the registry gate.
    [Theory]
    [InlineData("bundleDependencies")]
    [InlineData("bundledDependencies")]
    public void ReadNpmManifestReadsBundledNamesAsPins(string section)
    {
        var json = $$"""{ "dependencies": { "left-pad": "1.3.0" }, "{{section}}": ["left-pad", "right-pad"] }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe(
            [new PackagePin("web:left-pad", "1.3.0", "npm"), new PackagePin("web:right-pad", string.Empty, "npm")],
            ignoreOrder: true);
    }

    [Fact]
    public void ABundleAllFlagAddsNoPinOfItsOwn()
    {
        const string json = """{ "dependencies": { "left-pad": "1.3.0" }, "bundleDependencies": true }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe([new PackagePin("web:left-pad", "1.3.0", "npm")]);
    }

    // Fail closed: a dependency section the reader does not know (a typo, or a section a future npm adds) stops the
    // gate instead of being skipped silently.
    [Theory]
    [InlineData("devdependencies")]
    [InlineData("futureDependencies")]
    public void AnUnknownDependencySectionFailsNamingIt(string section)
    {
        var json = $$"""{ "{{section}}": { "left-pad": "1.3.0" } }""";

        Should.Throw<InvalidDataException>(() => PackagePins.ReadNpmManifest(json, "web"))
            .Message.ShouldContain($"'{section}'");
    }

    [Fact]
    public void PeerDependenciesMetaIsNotADependencySection()
    {
        const string json = """{ "peerDependenciesMeta": { "left-pad": { "optional": true } } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBeEmpty();
    }

    [Fact]
    public void ReadNpmManifestKeepsOneCopyOfAPinThatIsAlsoAnOverride()
    {
        const string json = """{ "devDependencies": { "axe-core": "4.13.0" }, "overrides": { "axe-core": "4.13.0" } }""";

        PackagePins.ReadNpmManifest(json, "web").ShouldBe([new PackagePin("web:axe-core", "4.13.0", "npm")]);
    }

    [Fact]
    public void ReadNpmManifestQualifiesIdsByManifestSoTheTwoTypescriptPinsNeverCollide()
    {
        const string web = """{ "devDependencies": { "@typescript/native": "npm:typescript@7.0.2" } }""";
        const string tool = """{ "devDependencies": { "typescript": "5.9.3" } }""";

        PackagePin[] pins = [.. PackagePins.ReadNpmManifest(web, "web"), .. PackagePins.ReadNpmManifest(tool, "tools/openapi-gen")];

        pins.ShouldBe(
            [new PackagePin("web:typescript", "7.0.2", "npm"), new PackagePin("tools/openapi-gen:typescript", "5.9.3", "npm")],
            ignoreOrder: true);
    }

    [Theory]
    [InlineData("^1.0.0")]
    [InlineData("~1.0.0")]
    [InlineData("1.x")]
    [InlineData(">=1.0.0")]
    [InlineData("latest")]
    [InlineData("npm:left-pad@^1.0.0")]
    public void AnNpmRangeFailsBecauseNpmPinsMustBeExact(string spec)
    {
        var json = $$"""{ "dependencies": { "left-pad": "{{spec}}" } }""";
        var registry = Registry();
        Entries(registry).Add(NpmEntry("left-pad", "1.0.0", "web"));

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. PackagePins.ReadNpmManifest(json, "web")])
            .ShouldContain(problem => problem.Contains("npm pins must be exact", StringComparison.Ordinal));
    }

    [Fact]
    public void RegistryWithNpmEntriesIsValid()
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("typescript", "5.9.3", "tools/openapi-gen"));
        Entries(registry).Add(NpmEntry("typescript", "7.0.2", "web"));
        Entries(registry).Add(NpmEntry("vite", "8.3.3", "web"));

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. NpmPins]).ShouldBeEmpty();
    }

    [Fact]
    public void NpmPinWithoutAnEntryFailsNamingIt()
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("typescript", "5.9.3", "tools/openapi-gen"));
        Entries(registry).Add(NpmEntry("typescript", "7.0.2", "web"));

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. NpmPins])
            .ShouldContain(problem => problem.Contains("web:vite 8.3.3 (npm) has no registry entry", StringComparison.Ordinal));
    }

    [Fact]
    public void NpmEntryOfAnUnknownKindFails()
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("typescript", "5.9.3", "tools/openapi-gen"));
        Entries(registry).Add(NpmEntry("typescript", "7.0.2", "web"));
        var vite = NpmEntry("vite", "8.3.3", "web");
        vite["kind"] = "yarn";
        Entries(registry).Add(vite);

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. NpmPins])
            .ShouldContain(problem => problem.Contains("kind 'yarn' must be one of nuget, tool, npm", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("")]
    [InlineData("app")]
    public void NpmEntryWithoutAKnownManifestFails(string manifest)
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("vite", "8.3.3", manifest));

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("manifest", StringComparison.Ordinal) && problem.Contains("web, tools/openapi-gen", StringComparison.Ordinal));
    }

    [Fact]
    public void NpmPinWhoseVersionDiffersFromTheRegistryFails()
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("typescript", "5.9.3", "tools/openapi-gen"));
        Entries(registry).Add(NpmEntry("typescript", "7.0.2", "web"));
        Entries(registry).Add(NpmEntry("vite", "8.3.2", "web"));

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. NpmPins])
            .ShouldContain(problem => problem.Contains("web:vite: pinned at 8.3.3 but the registry records 8.3.2", StringComparison.Ordinal));
    }

    [Fact]
    public void NpmEntriesAreSortedByManifestQualifiedId()
    {
        var registry = Registry();
        Entries(registry).Add(NpmEntry("typescript", "7.0.2", "web"));
        Entries(registry).Add(NpmEntry("typescript", "5.9.3", "tools/openapi-gen"));
        Entries(registry).Add(NpmEntry("vite", "8.3.3", "web"));

        DependencyRegistry.Validate(registry.ToJsonString(), [.. SamplePins, .. NpmPins])
            .ShouldContain(problem => problem.Contains("tools/openapi-gen:typescript: entries must be sorted", StringComparison.Ordinal));
    }

    [Fact]
    public void RepositoryDataFilesMatchTheirRecordedHashAndEveryEmbeddedFileHasARecord()
    {
        var json = File.ReadAllText(RepoRoot.PathOf(DependencyRegistry.RegistryPath));

        var problems = DependencyRegistry.Validate(json, PackagePins.ReadAll(), DataFiles.FromRepository());

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void RepositoryRegistryRecordsTheCommonPasswordListWithItsLicenseAndSource()
    {
        using var document = System.Text.Json.JsonDocument.Parse(File.ReadAllText(RepoRoot.PathOf(DependencyRegistry.RegistryPath)));

        var record = document.RootElement.GetProperty("packages").EnumerateArray()
            .Single(item => item.GetProperty("kind").GetString() == "data");

        record.GetProperty("license").GetString().ShouldBe("MIT");
        record.GetProperty("source").GetString().ShouldStartWith("https://raw.githubusercontent.com/danielmiessler/SecLists/");
        record.GetProperty("path").GetString().ShouldBe("src/Csps.Infrastructure/Passwords/common-passwords-10k.txt");
    }

    [Fact]
    public void ADataRecordWithMatchingBytesIsValid()
    {
        var (registry, files) = DataRegistry();

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, files).ShouldBeEmpty();
    }

    [Fact]
    public void ADataRecordNeedsNoPin()
    {
        var (registry, files) = DataRegistry();

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, files)
            .ShouldNotContain(problem => problem.Contains("no matching pin", StringComparison.Ordinal));
    }

    [Fact]
    public void ADataFileWhoseBytesDifferFromTheRecordedHashFails()
    {
        var (registry, _) = DataRegistry();
        var changed = new DataFiles(_ => "tampered"u8.ToArray(), [DataPath]);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, changed)
            .ShouldContain(problem => problem.Contains("sha256", StringComparison.Ordinal) && problem.Contains(DataPath, StringComparison.Ordinal));
    }

    [Fact]
    public void ADataFileThatIsMissingFails()
    {
        var (registry, _) = DataRegistry();
        var missing = new DataFiles(_ => null, [DataPath]);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, missing)
            .ShouldContain(problem => problem.Contains("file is missing", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("sha256", "")]
    [InlineData("sha256", "ABC123")]
    [InlineData("sha256", "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF")]
    [InlineData("path", "")]
    [InlineData("source", "")]
    [InlineData("source", "http://raw.githubusercontent.com/danielmiessler/SecLists/0123456789abcdef0123456789abcdef01234567/x.txt")]
    [InlineData("source", "https://raw.githubusercontent.com/danielmiessler/SecLists/master/x.txt")]
    public void ADataRecordWithABadSourceHashOrPathFails(string field, string value)
    {
        var (registry, files) = DataRegistry();
        Entries(registry)[0]![field] = value;

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, files)
            .ShouldContain(problem => problem.Contains(field, StringComparison.Ordinal));
    }

    [Fact]
    public void AnEmbeddedDataFileWithNoRecordFails()
    {
        var (registry, _) = DataRegistry();
        var extra = new DataFiles(_ => "data"u8.ToArray(), [DataPath, "src/Csps.Infrastructure/Passwords/unlisted.txt"]);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins, extra)
            .ShouldContain(problem => problem.Contains("unlisted.txt", StringComparison.Ordinal) && problem.Contains("no data record", StringComparison.Ordinal));
    }

    [Fact]
    public void OnlyDataEntriesMayNameASourceHashOrPath()
    {
        var registry = Registry();
        Entries(registry)[0]!["sha256"] = new string('a', 64);

        DependencyRegistry.Validate(registry.ToJsonString(), SamplePins)
            .ShouldContain(problem => problem.Contains("only data entries", StringComparison.Ordinal));
    }

    [Fact]
    public void ReadEmbeddedPathsListsEmbeddedResourcesRelativeToTheRepositoryAndSkipsResx()
    {
        const string csproj = """
            <Project Sdk="Microsoft.NET.Sdk">
              <ItemGroup>
                <EmbeddedResource Include="Passwords\list.txt" LogicalName="X.list.txt" />
                <EmbeddedResource Include="Strings.resx" />
              </ItemGroup>
            </Project>
            """;

        DataFiles.ReadEmbeddedPaths(csproj, "src/Csps.Infrastructure").ShouldBe(["src/Csps.Infrastructure/Passwords/list.txt"]);
    }

    private const string DataPath = "src/Csps.Infrastructure/Passwords/sample.txt";

    private static (JsonObject Registry, DataFiles Files) DataRegistry()
    {
        var bytes = "sample data"u8.ToArray();
        var registry = Registry();
        var entry = Entry("Alpha.Data", "0123456789abcdef0123456789abcdef01234567", "data", "runtime");
        entry["source"] = "https://raw.githubusercontent.com/danielmiessler/SecLists/0123456789abcdef0123456789abcdef01234567/Passwords/sample.txt";
        entry["sha256"] = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));
        entry["path"] = DataPath;
        var entries = Entries(registry);
        entries.Insert(0, entry);
        return (registry, new DataFiles(path => path == DataPath ? bytes : null, [DataPath]));
    }

    private static JsonObject NpmEntry(string id, string version, string manifest)
    {
        var entry = Entry(id, version, "npm", "build");
        entry["manifest"] = manifest;
        return entry;
    }

    private static JsonArray Entries(JsonObject registry) => registry["packages"]!.AsArray();

    private static JsonObject Registry() =>
        new()
        {
            ["policy"] = new JsonObject
            {
                ["coolDownDays"] = 14,
                ["allowedLicenses"] = new JsonArray("MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"),
                ["exceptions"] = new JsonArray(
                    new JsonObject { ["license"] = "MPL-2.0", ["scope"] = "test", ["reason"] = "axe-core, dev/test only (D-18)" },
                    new JsonObject { ["license"] = "OFL-1.1", ["scope"] = "font", ["reason"] = "@fontsource fonts (D-18)" }),
            },
            ["packages"] = new JsonArray(
                Entry("Alpha.Package", "1.2.3", "nuget", "runtime"),
                Entry("beta-tool", "4.5.6", "tool", "tool")),
        };

    private static JsonObject Entry(string id, string version, string kind, string scope) =>
        new()
        {
            ["id"] = id,
            ["version"] = version,
            ["kind"] = kind,
            ["scope"] = scope,
            ["purpose"] = "Sample purpose",
            ["license"] = "MIT",
            ["publisher"] = "Sample publisher",
            ["legitimacy"] = "Verified prefix, high downloads",
            ["published"] = "2026-09-01",
            ["adopted"] = "2026-10-07",
            ["coolDown"] = "aged",
        };
}
