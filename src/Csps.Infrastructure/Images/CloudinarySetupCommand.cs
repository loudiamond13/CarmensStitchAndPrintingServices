using System.Globalization;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The owner's one-time command (IMG-04, D-03, D-33): makes sure the account holds the 13 named sizes of <see cref="ImageNamedSizes"/>,
/// the step before strict transformations are turned on. It creates a missing size, allowed for strict mode, and never changes or
/// deletes one that already exists, because live photos use it (T-09-65). It prints size names and counts only (T-09-66).
/// Exit codes: 0 done, 1 a size exists with another definition, 2 the keys are not set, 3 Cloudinary did not accept the calls.
/// </summary>
/// <param name="settings">The account settings.</param>
/// <param name="httpClients">Hands out the Cloudinary HTTP client.</param>
public sealed class CloudinarySetupCommand(CloudinarySettings settings, IHttpClientFactory httpClients)
{
    /// <summary>The exit code of a run that finished with nothing to decide.</summary>
    public const int Succeeded = 0;

    /// <summary>The exit code when a named size exists with another definition; the owner decides.</summary>
    public const int Different = 1;

    /// <summary>The exit code when the cloud name, key or secret is not set.</summary>
    public const int NotConfigured = 2;

    /// <summary>The exit code when Cloudinary refused, was busy or did not answer.</summary>
    public const int Failed = 3;

    /// <summary>The exit code for an argument the command does not know.</summary>
    public const int UsageError = 64;

    /// <summary>The usage line.</summary>
    public const string Usage = "Use --check to look without changing anything. Use no argument to create the missing sizes.";

    private const string CheckFlag = "--check";
    private const int MaxPages = 20;
    private const int PageSize = 500;
    private const string NamedPrefix = "t_";

    private static readonly Dictionary<string, string> ShortKeys = new(StringComparer.Ordinal)
    {
        ["crop"] = "c",
        ["gravity"] = "g",
        ["width"] = "w",
        ["height"] = "h",
        ["quality"] = "q",
        ["fetch_format"] = "f",
    };

    /// <summary>Reads the command-line arguments.</summary>
    /// <param name="args">The arguments: none, or <c>--check</c>.</param>
    /// <param name="checkOnly">Set to true when the run must change nothing.</param>
    /// <returns>True when every argument is known.</returns>
    public static bool TryReadArguments(string[] args, out bool checkOnly)
    {
        ArgumentNullException.ThrowIfNull(args);
        checkOnly = args.Length == 1 && string.Equals(args[0], CheckFlag, StringComparison.Ordinal);
        return args.Length == 0 || checkOnly;
    }

    /// <summary>Looks at the 13 sizes and, unless this is a check, creates the missing ones.</summary>
    /// <param name="checkOnly">True to change nothing.</param>
    /// <param name="output">Receives the report: size names and counts only.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public async Task<int> RunAsync(bool checkOnly, TextWriter output, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(output);
        if (!settings.IsConfigured)
        {
            await output.WriteLineAsync("Set Cloudinary:CloudName, Cloudinary:ApiKey and Cloudinary:ApiSecret first.").ConfigureAwait(false);
            return NotConfigured;
        }

        var client = new Cloudinary(new Account(settings.CloudName, settings.ApiKey, settings.ApiSecret))
        {
            Api = { Secure = true, Client = httpClients.CreateClient(CloudinaryImageStorage.HttpClientName) },
        };

        try
        {
            var states = await ReadStatesAsync(client, cancellationToken).ConfigureAwait(false);
            var created = new HashSet<string>(StringComparer.Ordinal);
            if (!checkOnly)
            {
                foreach (var size in ImageNamedSizes.All.Where(size => states[size.Name] == SizeState.Missing))
                {
                    await CreateAsync(client, size, cancellationToken).ConfigureAwait(false);
                    created.Add(size.Name);
                }
            }

            await ReportAsync(output, states, created).ConfigureAwait(false);
            return states.ContainsValue(SizeState.Different) ? Different : Succeeded;
        }
        catch (SetupFailure failure)
        {
            await output.WriteLineAsync(failure.Message).ConfigureAwait(false);
            return Failed;
        }
    }

    private static async Task ReportAsync(TextWriter output, Dictionary<string, SizeState> states, HashSet<string> created)
    {
        foreach (var size in ImageNamedSizes.All)
        {
            var word = created.Contains(size.Name) ? "created" : states[size.Name].ToString().ToLowerInvariant();
            await output.WriteLineAsync($"{size.Name}: {word}").ConfigureAwait(false);
        }

        var exist = states.Values.Count(state => state == SizeState.Exists);
        var different = states.Values.Count(state => state == SizeState.Different);
        var missing = states.Values.Count(state => state == SizeState.Missing) - created.Count;
        var summary = new List<string> { $"{exist} exist" };
        if (different > 0)
        {
            summary.Add($"{different} different");
        }

        if (missing > 0)
        {
            summary.Add($"{missing} missing");
        }

        if (created.Count > 0)
        {
            summary.Add($"{created.Count} created");
        }

        await output.WriteLineAsync(string.Join(", ", summary)).ConfigureAwait(false);
        if (different > 0)
        {
            await output.WriteLineAsync("A size that is different was left as it is. Ask before changing it: live photos use it.").ConfigureAwait(false);
        }
    }

    // Names are matched without an optional "t_" prefix; the detail call uses the name exactly as the list gave it.
    private static async Task<Dictionary<string, SizeState>> ReadStatesAsync(Cloudinary client, CancellationToken cancellationToken)
    {
        var listed = await ListNamesAsync(client, cancellationToken).ConfigureAwait(false);
        var states = new Dictionary<string, SizeState>(StringComparer.Ordinal);
        foreach (var size in ImageNamedSizes.All)
        {
            if (!listed.TryGetValue(size.Name, out var listedName))
            {
                states[size.Name] = SizeState.Missing;
                continue;
            }

            var detail = await Guarded(() => client.GetTransformAsync(listedName, cancellationToken), cancellationToken).ConfigureAwait(false);
            states[size.Name] = Matches(size, detail.JsonObj) ? SizeState.Exists : SizeState.Different;
        }

        return states;
    }

    private static async Task<Dictionary<string, string>> ListNamesAsync(Cloudinary client, CancellationToken cancellationToken)
    {
        var names = new Dictionary<string, string>(StringComparer.Ordinal);
        string? cursor = null;
        for (var page = 0; page < MaxPages; page++)
        {
            var parameters = new ListTransformsParams { Named = true, MaxResults = PageSize, NextCursor = cursor };
            var result = await Guarded(() => client.ListTransformationsAsync(parameters, cancellationToken), cancellationToken).ConfigureAwait(false);
            foreach (var item in result.JsonObj?["transformations"] ?? new JArray())
            {
                var name = item.Value<string>("name");
                if (!string.IsNullOrEmpty(name))
                {
                    names[name.StartsWith(NamedPrefix, StringComparison.Ordinal) ? name[NamedPrefix.Length..] : name] = name;
                }
            }

            cursor = result.JsonObj?.Value<string>("next_cursor");
            if (string.IsNullOrEmpty(cursor))
            {
                break;
            }
        }

        return names;
    }

    private static async Task CreateAsync(Cloudinary client, ImageNamedSize size, CancellationToken cancellationToken)
    {
        var create = new CreateTransformParams { Name = size.Name, Transform = new Transformation().RawTransformation(size.Transformation) };
        await Guarded(() => client.CreateTransformAsync(create, cancellationToken), cancellationToken).ConfigureAwait(false);

        // Set outright, so strict mode accepts the size whatever the account's default is.
        var allow = new UpdateTransformParams { Transformation = size.Name, AllowedForStrict = true };
        await Guarded(() => client.UpdateTransformAsync(allow, cancellationToken), cancellationToken).ConfigureAwait(false);
    }

    // Runs one admin call. A refusal or a failed transfer becomes a SetupFailure with a message that holds no key and no account name.
    private static async Task<TResult> Guarded<TResult>(Func<Task<TResult>> call, CancellationToken cancellationToken)
        where TResult : BaseResult
    {
        try
        {
            var result = await call().ConfigureAwait(false);
            if (CloudinaryResults.IsSuccess(result.StatusCode))
            {
                return result;
            }

            throw new SetupFailure(CloudinaryResults.FailureCode(result.StatusCode) switch
            {
                CloudinaryResults.UnauthorizedCode => "Cloudinary refused the keys.",
                CloudinaryResults.TransientCode => BusyMessage,
                _ => $"Cloudinary refused the request (HTTP {(int)result.StatusCode}).",
            });
        }
        catch (Exception failure) when (failure is not SetupFailure && IsTransientFailure(failure, cancellationToken))
        {
            throw new SetupFailure(BusyMessage);
        }
    }

    private static string BusyMessage => "Cloudinary is busy or did not answer. Try again later.";

    private static bool IsTransientFailure(Exception failure, CancellationToken cancellationToken) => failure switch
    {
        OperationCanceledException => !cancellationToken.IsCancellationRequested,
        HttpRequestException or TimeoutException or JsonException => true,
        { InnerException: JsonException } => true,
        _ => false,
    };

    private static bool Matches(ImageNamedSize size, JToken? detail)
    {
        if (detail is null || detail.Value<bool?>("allowed_for_strict") == false)
        {
            return false;
        }

        var info = detail["info"];
        return info is not null && Normalize(size.Transformation).SequenceEqual(NormalizeInfo(info), StringComparer.Ordinal);
    }

    // "c_fill,g_auto,w_44/q_auto" becomes ["c_fill,g_auto,w_44", "q_auto"] with the pairs sorted inside each part.
    private static IEnumerable<string> Normalize(string transformation) =>
        transformation.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => string.Join(',', part.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Order(StringComparer.Ordinal)));

    // The Admin API describes a named size as one object per part with long key names, or as the string itself.
    private static IEnumerable<string> NormalizeInfo(JToken info) => info.Type switch
    {
        JTokenType.String => Normalize(info.Value<string>() ?? string.Empty),
        JTokenType.Array => info.SelectMany(part => NormalizeInfo(part)),
        JTokenType.Object => [string.Join(',', ((JObject)info).Properties().Select(PairOf).Order(StringComparer.Ordinal))],
        _ => ["?"],
    };

    private static string PairOf(JProperty property)
    {
        var key = ShortKeys.TryGetValue(property.Name, out var shortKey) ? shortKey : property.Name;
        var value = property.Value is JValue plain ? Convert.ToString(plain.Value, CultureInfo.InvariantCulture) : property.Value.ToString();
        return $"{key}_{value}";
    }

    private enum SizeState
    {
        Exists = 1,
        Missing = 2,
        Different = 3,
    }

    // A stop with a message that is safe to print.
    private sealed class SetupFailure(string message) : Exception(message);
}
