using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Validates docs/dependencies.json against the pinned packages, tools and npm packages (QUAL-06, D-00, D-18, D-19,
/// L-08). Pure: takes the registry text and the pins, returns every problem found (empty means valid). An npm entry
/// names its manifest folder; it matches the pin <c>{manifest}:{id}</c>, and the list is sorted by that key.
/// </summary>
internal static class DependencyRegistry
{
    public const string RegistryPath = "docs/dependencies.json";

    private const string DateFormat = "yyyy-MM-dd";
    private const string AcceptedPrefix = "accepted:";
    private const string NpmKind = "npm";

    private static readonly string[] Kinds = ["nuget", "tool", NpmKind];
    private static readonly string[] Scopes = ["runtime", "build", "test", "tool", "font"];
    private static readonly string[] RequiredText = ["purpose", "license", "publisher", "legitimacy"];

    // One exact semver version: no range operator, wildcard, tag or alias.
    private static readonly Regex ExactNpmVersion = new(
        @"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$",
        RegexOptions.CultureInvariant,
        TimeSpan.FromSeconds(1));

    /// <summary>Returns every rule violation in <paramref name="json"/> given the repository pins.</summary>
    public static List<string> Validate(string? json, IReadOnlyCollection<PackagePin> pins)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [$"{RegistryPath} is missing or empty. Every pinned package and tool needs a registry entry."];
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(json);
        }
        catch (JsonException exception)
        {
            return [$"{RegistryPath} is not valid JSON: {exception.Message}"];
        }

        using (document)
        {
            var problems = new List<string>();
            var root = document.RootElement;
            var policy = ReadPolicy(root, problems);
            var entries = ReadEntries(root, problems);
            if (policy is null || entries is null)
            {
                return problems;
            }

            foreach (var entry in entries)
            {
                ValidateEntry(entry, policy, problems);
            }

            ValidateOrder(entries, problems);
            ValidateAgainstPins(entries, pins, problems);
            return problems;
        }
    }

    private static Policy? ReadPolicy(JsonElement root, List<string> problems)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("policy", out var policy)
            || policy.ValueKind != JsonValueKind.Object)
        {
            problems.Add("The registry has no policy object.");
            return null;
        }

        if (!policy.TryGetProperty("coolDownDays", out var days) || !days.TryGetInt32(out var coolDownDays) || coolDownDays < 1)
        {
            problems.Add("policy.coolDownDays must be a positive whole number.");
            return null;
        }

        var allowed = policy.TryGetProperty("allowedLicenses", out var allowedElement)
            && allowedElement.ValueKind == JsonValueKind.Array
                ? allowedElement.EnumerateArray().Select(item => item.GetString() ?? string.Empty).Where(item => item.Length > 0).ToList()
                : [];
        if (allowed.Count == 0)
        {
            problems.Add("policy.allowedLicenses must list at least one license.");
            return null;
        }

        var exceptions = policy.TryGetProperty("exceptions", out var exceptionElement)
            && exceptionElement.ValueKind == JsonValueKind.Array
                ? exceptionElement.EnumerateArray()
                    .Select(item => new LicenseException(Text(item, "license"), Text(item, "scope"), Text(item, "reason")))
                    .ToList()
                : [];
        foreach (var exception in exceptions.Where(item => item.License.Length == 0 || item.Scope.Length == 0 || item.Reason.Length == 0))
        {
            problems.Add($"policy.exceptions entry '{exception.License}' needs a license, a scope and a reason.");
        }

        return new Policy(coolDownDays, allowed, exceptions);
    }

    private static List<Entry>? ReadEntries(JsonElement root, List<string> problems)
    {
        if (!root.TryGetProperty("packages", out var packages) || packages.ValueKind != JsonValueKind.Array
            || packages.GetArrayLength() == 0)
        {
            problems.Add("The registry lists no packages. Every pinned package and tool needs an entry.");
            return null;
        }

        return packages.EnumerateArray()
            .Select(item => new Entry(
                Text(item, "id"),
                Text(item, "version"),
                Text(item, "kind"),
                Text(item, "scope"),
                RequiredText.ToDictionary(field => field, field => Text(item, field), StringComparer.Ordinal),
                Text(item, "published"),
                Text(item, "adopted"),
                Text(item, "coolDown"),
                Text(item, "manifest")))
            .ToList();
    }

    private static void ValidateEntry(Entry entry, Policy policy, List<string> problems)
    {
        var label = entry.Id.Length > 0 ? entry.Key : "(entry without id)";
        if (entry.Id.Length == 0)
        {
            problems.Add("A registry entry has an empty id.");
        }

        if (entry.Version.Length == 0)
        {
            problems.Add($"{label}: version is empty.");
        }

        if (!Kinds.Contains(entry.Kind, StringComparer.Ordinal))
        {
            problems.Add($"{label}: kind '{entry.Kind}' must be one of {string.Join(", ", Kinds)}.");
        }

        if (string.Equals(entry.Kind, NpmKind, StringComparison.Ordinal))
        {
            if (!PackagePins.NpmManifests.Contains(entry.Manifest, StringComparer.Ordinal))
            {
                problems.Add($"{label}: manifest '{entry.Manifest}' must be one of {string.Join(", ", PackagePins.NpmManifests)}.");
            }
        }
        else if (entry.Manifest.Length > 0)
        {
            problems.Add($"{label}: only npm entries name a manifest.");
        }

        if (!Scopes.Contains(entry.Scope, StringComparer.Ordinal))
        {
            problems.Add($"{label}: scope '{entry.Scope}' must be one of {string.Join(", ", Scopes)}.");
        }

        foreach (var (field, value) in entry.Text)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                problems.Add($"{label}: {field} is empty.");
            }
        }

        ValidateLicense(label, entry, policy, problems);
        ValidateCoolDown(label, entry, policy, problems);
    }

    private static void ValidateLicense(string label, Entry entry, Policy policy, List<string> problems)
    {
        var license = entry.Text["license"];
        if (license.Length == 0 || policy.AllowedLicenses.Contains(license, StringComparer.Ordinal))
        {
            return;
        }

        var exception = policy.Exceptions.FirstOrDefault(item => string.Equals(item.License, license, StringComparison.Ordinal));
        if (exception is null)
        {
            problems.Add($"{label}: license '{license}' is not allowed.");
        }
        else if (!string.Equals(exception.Scope, entry.Scope, StringComparison.Ordinal))
        {
            problems.Add($"{label}: license '{license}' is allowed only for scope '{exception.Scope}', not '{entry.Scope}'.");
        }
    }

    private static void ValidateCoolDown(string label, Entry entry, Policy policy, List<string> problems)
    {
        var published = ParseDate(entry.Published);
        var adopted = ParseDate(entry.Adopted);
        if (published is null)
        {
            problems.Add($"{label}: published '{entry.Published}' must be a {DateFormat} date.");
        }

        if (adopted is null)
        {
            problems.Add($"{label}: adopted '{entry.Adopted}' must be a {DateFormat} date.");
        }

        if (string.Equals(entry.CoolDown, "aged", StringComparison.Ordinal))
        {
            if (published is { } from && adopted is { } to && to.DayNumber - from.DayNumber < policy.CoolDownDays)
            {
                problems.Add(
                    $"{label}: marked aged but adopted {to.DayNumber - from.DayNumber} days after release; the cool-down is {policy.CoolDownDays} days.");
            }
        }
        else if (entry.CoolDown.StartsWith(AcceptedPrefix, StringComparison.Ordinal))
        {
            if (entry.CoolDown[AcceptedPrefix.Length..].Trim().Length == 0)
            {
                problems.Add($"{label}: an accepted cool-down exception needs a recorded reason.");
            }
        }
        else
        {
            problems.Add($"{label}: coolDown must be \"aged\" or \"accepted: <reason>\".");
        }
    }

    private static void ValidateOrder(List<Entry> entries, List<string> problems)
    {
        for (var index = 1; index < entries.Count; index++)
        {
            var comparison = string.Compare(entries[index - 1].Key, entries[index].Key, StringComparison.OrdinalIgnoreCase);
            if (comparison == 0)
            {
                problems.Add($"{entries[index].Key}: duplicate registry entry.");
            }
            else if (comparison > 0)
            {
                problems.Add($"{entries[index].Key}: entries must be sorted by id; it comes after {entries[index - 1].Key}.");
            }
        }
    }

    private static void ValidateAgainstPins(List<Entry> entries, IReadOnlyCollection<PackagePin> pins, List<string> problems)
    {
        foreach (var pin in pins)
        {
            var isNpm = string.Equals(pin.Source, PackagePins.NpmSource, StringComparison.Ordinal);
            if (isNpm && !ExactNpmVersion.IsMatch(pin.Version))
            {
                problems.Add($"{pin.Id}: '{pin.Version}' is a range, tag or empty; npm pins must be exact (one version, for example 1.2.3).");
            }

            var matches = entries.Where(entry => string.Equals(entry.Key, pin.Id, StringComparison.OrdinalIgnoreCase)).ToList();
            if (matches.Count == 0)
            {
                problems.Add($"{pin.Id} {pin.Version} ({pin.Source}) has no registry entry.");
                continue;
            }

            var entry = matches[0];
            if (!string.Equals(entry.Version, pin.Version, StringComparison.Ordinal))
            {
                problems.Add($"{pin.Id}: pinned at {pin.Version} but the registry records {entry.Version}.");
            }

            var expectedKind = isNpm ? NpmKind : string.Equals(pin.Source, "tool", StringComparison.Ordinal) ? "tool" : "nuget";
            if (!string.Equals(entry.Kind, expectedKind, StringComparison.Ordinal))
            {
                problems.Add($"{pin.Id}: registry kind is '{entry.Kind}' but the pin is a {expectedKind}.");
            }
        }

        foreach (var entry in entries.Where(entry => !pins.Any(pin => string.Equals(pin.Id, entry.Key, StringComparison.OrdinalIgnoreCase))))
        {
            problems.Add($"{entry.Key}: registry entry has no matching pin (stale entry).");
        }
    }

    private static DateOnly? ParseDate(string value) =>
        DateOnly.TryParseExact(value, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ? date : null;

    private static string Text(JsonElement item, string property) =>
        item.ValueKind == JsonValueKind.Object && item.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()!.Trim()
            : string.Empty;

    private sealed record Policy(int CoolDownDays, List<string> AllowedLicenses, List<LicenseException> Exceptions);

    private sealed record LicenseException(string License, string Scope, string Reason);

    private sealed record Entry(
        string Id,
        string Version,
        string Kind,
        string Scope,
        Dictionary<string, string> Text,
        string Published,
        string Adopted,
        string CoolDown,
        string Manifest)
    {
        /// <summary>The id a pin matches: <c>{manifest}:{id}</c> for npm entries, the plain id otherwise.</summary>
        public string Key => string.Equals(Kind, NpmKind, StringComparison.Ordinal) ? $"{Manifest}:{Id}" : Id;
    }
}
