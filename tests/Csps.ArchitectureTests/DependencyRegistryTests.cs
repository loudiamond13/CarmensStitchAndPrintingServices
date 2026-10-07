using System.Text.Json.Nodes;

namespace Csps.ArchitectureTests;

/// <summary>Dependency registry rules (QUAL-06, D-00, D-18, D-19).</summary>
public sealed class DependencyRegistryTests
{
    private static readonly PackagePin AlphaPin = new("Alpha.Package", "1.2.3", "PackageVersion");
    private static readonly PackagePin BetaPin = new("beta-tool", "4.5.6", "tool");
    private static readonly PackagePin[] SamplePins = [AlphaPin, BetaPin];

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
