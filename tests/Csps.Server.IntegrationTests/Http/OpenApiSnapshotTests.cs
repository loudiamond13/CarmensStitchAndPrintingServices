using System.Globalization;
using System.Net;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// D-16: the committed <c>tools/openapi-gen/openapi.v1.json</c> is a normalized copy of the Development
/// <c>/openapi/v1.json</c>. The web types are generated from that snapshot, so a contract change that is not
/// re-snapshotted (and re-generated) fails here instead of breaking the client silently (T-02-41).
/// </summary>
public sealed partial class OpenApiSnapshotTests
{
    /// <summary>
    /// The per-process switch that rewrites the snapshot. Set it for one command only, never at user or machine
    /// level: <c>CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests
    /// --filter-class "*OpenApiSnapshotTests"</c>.
    /// </summary>
    public const string WriteSwitch = "CSPS_WRITE_OPENAPI_SNAPSHOT";

    /// <summary>The snapshot path relative to the repository root.</summary>
    public const string SnapshotRelativePath = "tools/openapi-gen/openapi.v1.json";

    private const string SolutionFileName = "Csps.slnx";

    private static readonly JsonSerializerOptions CanonicalOptions = new()
    {
        WriteIndented = true,
        IndentSize = 2,
        NewLine = "\n",

        // The snapshot is a developer-facing file, never HTML: keep '+', '<' and quotes readable instead of \uXXXX.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    [Fact]
    public async Task CommittedSnapshotMatchesTheLiveDocument()
    {
        // The document needs no database; the parameterless factory never opens one.
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var live = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        var snapshotPath = Path.Combine(RepositoryRoot(), SnapshotRelativePath.Replace('/', Path.DirectorySeparatorChar));
        if (Environment.GetEnvironmentVariable(WriteSwitch) == "1")
        {
            await File.WriteAllTextAsync(snapshotPath, Canonicalize(live), TestContext.Current.CancellationToken);

            // A write run never passes, so a CI job with the switch set by mistake still fails.
            Assert.Fail($"Snapshot written to {SnapshotRelativePath}; run again without {WriteSwitch}.");
        }

        File.Exists(snapshotPath).ShouldBeTrue($"{SnapshotRelativePath} is missing. {RefreshHint}");
        var committed = await File.ReadAllTextAsync(snapshotPath, TestContext.Current.CancellationToken);

        Difference(committed, live).ShouldBeNull();
    }

    [Fact]
    public void CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder()
    {
        var canonical = Canonicalize("""{"b":1,"a":{"z":[3,1,{"y":true,"B":null}],"a":"x+y"},"A":2}""");

        canonical.ShouldBe(
            "{\n  \"A\": 2,\n  \"a\": {\n    \"a\": \"x+y\",\n    \"z\": [\n      3,\n      1,\n      {\n"
            + "        \"B\": null,\n        \"y\": true\n      }\n    ]\n  },\n  \"b\": 1\n}\n");
    }

    [Fact]
    public void KeyOrderAndWhitespaceAreNotDifferences()
    {
        Difference("""{ "b": [1, 2], "a": { "y": "x", "x": null } }""", """{"a":{"x":null,"y":"x"},"b":[1,2]}""").ShouldBeNull();
    }

    [Theory]
    [InlineData(
        """{"components":{"schemas":{"SiteSettingsDto":{"properties":{"locale":{"type":"string"}}}}}}""",
        """{"components":{"schemas":{"SiteSettingsDto":{"properties":{"localeName":{"type":"string"}}}}}}""",
        "$.components.schemas.SiteSettingsDto.properties.locale")]
    [InlineData(
        """{"paths":{"/api/v1/site-settings":{"get":{"operationId":"Old"}}}}""",
        """{"paths":{"/api/v1/site-settings":{"get":{"operationId":"GetSiteSettings"}}}}""",
        "$.paths['/api/v1/site-settings'].get.operationId")]
    [InlineData("""{"required":["a","b"]}""", """{"required":["a","c"]}""", "$.required[1]")]
    [InlineData("""{"required":["a"]}""", """{"required":["a","b"]}""", "$.required")]
    [InlineData("""{"n":1}""", """{"n":"1"}""", "$.n")]
    public void AnEditedSnapshotFailsNamingTheChangedPath(string committed, string live, string path)
    {
        var difference = Difference(committed, live).ShouldNotBeNull();

        difference.ShouldContain(path, Case.Sensitive);
        difference.ShouldContain(SnapshotRelativePath, Case.Sensitive);
        difference.ShouldContain(WriteSwitch, Case.Sensitive);
        difference.ShouldContain("npm --prefix tools/openapi-gen run generate", Case.Sensitive);
    }

    [Fact]
    public void ASnapshotThatIsNotJsonFailsWithAPlainMessage()
    {
        var difference = Difference("not json", "{}").ShouldNotBeNull();

        difference.ShouldContain("is not valid JSON", Case.Sensitive);
    }

    private static string RefreshHint =>
        $"Refresh it with {WriteSwitch}=1 for one command (dotnet test --project tests/Csps.Server.IntegrationTests "
        + "--filter-class \"*OpenApiSnapshotTests\"), then run npm --prefix tools/openapi-gen run generate and commit "
        + "both files (docs/web/api.md).";

    /// <summary>Rebuilds the document with ordinally sorted object keys, 2-space indent, LF and a final newline.</summary>
    /// <param name="json">The document text.</param>
    /// <returns>The canonical text.</returns>
    internal static string Canonicalize(string json)
    {
        var node = JsonNode.Parse(json) ?? throw new InvalidOperationException("The OpenAPI document is empty.");
        return Sorted(node)!.ToJsonString(CanonicalOptions) + "\n";
    }

    /// <summary>
    /// Compares the committed snapshot with the live document after normalization (key order and whitespace never
    /// count) and describes the first difference by its JSON path, or returns null when they match.
    /// </summary>
    /// <param name="committed">The committed snapshot text.</param>
    /// <param name="live">The live document text.</param>
    /// <returns>Null when equal; otherwise a message naming the path and how to refresh the snapshot.</returns>
    internal static string? Difference(string committed, string live)
    {
        JsonNode? snapshot;
        try
        {
            snapshot = JsonNode.Parse(committed);
        }
        catch (JsonException)
        {
            return $"{SnapshotRelativePath} is not valid JSON. {RefreshHint}";
        }

        var found = FirstDifference(Sorted(snapshot), Sorted(JsonNode.Parse(live)), "$");
        return found is null
            ? null
            : $"The API contract changed: {SnapshotRelativePath} differs from the live /openapi/v1.json at {found}. {RefreshHint}";
    }

    private static string? FirstDifference(JsonNode? committed, JsonNode? live, string path)
    {
        switch (committed, live)
        {
            case (JsonObject left, JsonObject right):
                foreach (var key in left.Select(property => property.Key)
                    .Union(right.Select(property => property.Key), StringComparer.Ordinal)
                    .Order(StringComparer.Ordinal))
                {
                    var child = Member(path, key);
                    if (!left.ContainsKey(key))
                    {
                        return $"{child} (only in the live document)";
                    }

                    if (!right.ContainsKey(key))
                    {
                        return $"{child} (only in the snapshot)";
                    }

                    if (FirstDifference(left[key], right[key], child) is { } nested)
                    {
                        return nested;
                    }
                }

                return null;

            case (JsonArray left, JsonArray right):
                for (var index = 0; index < Math.Min(left.Count, right.Count); index++)
                {
                    if (FirstDifference(left[index], right[index], $"{path}[{index.ToString(CultureInfo.InvariantCulture)}]") is { } nested)
                    {
                        return nested;
                    }
                }

                return left.Count == right.Count
                    ? null
                    : $"{path} (snapshot has {left.Count.ToString(CultureInfo.InvariantCulture)} items, live has {right.Count.ToString(CultureInfo.InvariantCulture)})";

            default:
                return JsonNode.DeepEquals(committed, live)
                    ? null
                    : $"{path} (snapshot {Show(committed)}, live {Show(live)})";
        }
    }

    private static string Member(string path, string key) =>
        IdentifierKey().IsMatch(key) ? $"{path}.{key}" : $"{path}['{key}']";

    private static string Show(JsonNode? node) => node?.ToJsonString(CanonicalOptions) ?? "null";

    private static JsonNode? Sorted(JsonNode? node) => node switch
    {
        JsonObject obj => new JsonObject(obj
            .OrderBy(property => property.Key, StringComparer.Ordinal)
            .Select(property => KeyValuePair.Create(property.Key, Sorted(property.Value)))),
        JsonArray array => new JsonArray([.. array.Select(Sorted)]),
        null => null,
        _ => node.DeepClone(),
    };

    // Walks up from the test output folder to the folder that holds Csps.slnx (the repository root).
    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, SolutionFileName)))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"{SolutionFileName} not found above {AppContext.BaseDirectory}.");
    }

    [GeneratedRegex("^[A-Za-z_$][A-Za-z0-9_$]*$", RegexOptions.CultureInvariant)]
    private static partial Regex IdentifierKey();
}
