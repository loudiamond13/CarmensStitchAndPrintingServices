using System.Net;
using System.Runtime.CompilerServices;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// D-16: the committed <c>tools/openapi-gen/openapi.v1.json</c> is a canonical copy of the Development
/// <c>/openapi/v1.json</c>. The web types are generated from that snapshot, so a contract change that is not
/// re-snapshotted (and re-generated) fails here instead of breaking the client silently (T-02-28).
/// </summary>
public sealed class OpenApiSnapshotTests
{
    /// <summary>
    /// The per-process switch that rewrites the snapshot. Set it for one command only, never at user or machine
    /// level: <c>CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests
    /// --filter-class "*OpenApiSnapshotTests"</c>.
    /// </summary>
    public const string WriteSwitch = "CSPS_WRITE_OPENAPI_SNAPSHOT";

    private const string SnapshotRelativePath = "tools/openapi-gen/openapi.v1.json";

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
        var live = Canonicalize(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        if (Environment.GetEnvironmentVariable(WriteSwitch) == "1")
        {
            var target = Path.Combine(RepositoryRoot(), SnapshotRelativePath);
            await File.WriteAllTextAsync(target, live, TestContext.Current.CancellationToken);

            // A write run never passes, so a CI job with the switch set by mistake still fails.
            Assert.Fail($"Snapshot written; run again without {WriteSwitch}");
        }

        var committedPath = Path.Combine(AppContext.BaseDirectory, "Fixtures", "openapi.v1.json");
        File.Exists(committedPath).ShouldBeTrue($"{SnapshotRelativePath} is not linked into the test output.");
        var committed = (await File.ReadAllTextAsync(committedPath, TestContext.Current.CancellationToken)).ReplaceLineEndings("\n");

        committed.ShouldBe(
            live,
            $"The API contract changed. Refresh {SnapshotRelativePath} with {WriteSwitch}=1 (one command), then run "
            + "npm --prefix tools/openapi-gen run generate (docs/development.md, API types).");
    }

    [Fact]
    public void CanonicalFormSortsObjectKeysOrdinallyAndKeepsArrayOrder()
    {
        var canonical = Canonicalize("""{"b":1,"a":{"z":[3,1,{"y":true,"B":null}],"a":"x+y"},"A":2}""");

        canonical.ShouldBe(
            "{\n  \"A\": 2,\n  \"a\": {\n    \"a\": \"x+y\",\n    \"z\": [\n      3,\n      1,\n      {\n"
            + "        \"B\": null,\n        \"y\": true\n      }\n    ]\n  },\n  \"b\": 1\n}\n");
    }

    /// <summary>Rebuilds the document with ordinally sorted object keys, 2-space indent, LF and a final newline.</summary>
    /// <param name="json">The document text.</param>
    /// <returns>The canonical text.</returns>
    internal static string Canonicalize(string json)
    {
        var node = JsonNode.Parse(json) ?? throw new InvalidOperationException("The OpenAPI document is empty.");
        return Sorted(node)!.ToJsonString(CanonicalOptions) + "\n";
    }

    private static JsonNode? Sorted(JsonNode? node) => node switch
    {
        JsonObject obj => new JsonObject(obj
            .OrderBy(property => property.Key, StringComparer.Ordinal)
            .Select(property => KeyValuePair.Create(property.Key, Sorted(property.Value)))),
        JsonArray array => new JsonArray([.. array.Select(Sorted)]),
        null => null,
        _ => node.DeepClone(),
    };

    // Walks up from this source file to the folder that holds Csps.slnx (the repository root).
    private static string RepositoryRoot([CallerFilePath] string sourceFile = "")
    {
        for (var directory = Path.GetDirectoryName(sourceFile); directory is not null; directory = Path.GetDirectoryName(directory))
        {
            if (File.Exists(Path.Combine(directory, "Csps.slnx")))
            {
                return directory;
            }
        }

        throw new InvalidOperationException($"Csps.slnx not found above {sourceFile}.");
    }
}
