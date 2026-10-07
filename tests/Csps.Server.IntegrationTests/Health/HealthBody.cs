using System.Text.Json;

namespace Csps.Server.IntegrationTests.Health;

/// <summary>Reads a <c>/health</c> body for the D-23 "status plus name/status pairs only" assertions.</summary>
internal static class HealthBody
{
    /// <summary>The only property names a health body may contain, at any depth.</summary>
    public static readonly string[] AllowedPropertyNames = ["status", "checks", "name"];

    /// <summary>Returns every distinct property name in <paramref name="json"/>, at any depth.</summary>
    public static List<string> PropertyNames(string json)
    {
        using var document = JsonDocument.Parse(json);
        var names = new List<string>();
        Collect(document.RootElement, names);
        return [.. names.Distinct(StringComparer.Ordinal)];
    }

    /// <summary>Returns the overall status and each check's status by name.</summary>
    public static (string Status, Dictionary<string, string> Checks) Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var checks = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var check in root.GetProperty("checks").EnumerateArray())
        {
            checks.Add(check.GetProperty("name").GetString()!, check.GetProperty("status").GetString()!);
        }

        return (root.GetProperty("status").GetString()!, checks);
    }

    private static void Collect(JsonElement current, List<string> sink)
    {
        switch (current.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in current.EnumerateObject())
                {
                    sink.Add(property.Name);
                    Collect(property.Value, sink);
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in current.EnumerateArray())
                {
                    Collect(item, sink);
                }

                break;
            default:
                break;
        }
    }
}
