using System.Collections.Frozen;
using Csps.Application.Ports;

namespace Csps.Infrastructure.Passwords;

/// <summary>
/// The SecLists top-10k common passwords (MIT), embedded in the assembly and loaded once on first use (D-14, D-36).
/// The file is pinned by hash in <c>docs/dependencies.json</c>.
/// </summary>
internal sealed class CommonPasswordList : ICommonPasswords
{
    /// <summary>The manifest name of the embedded list.</summary>
    internal const string ResourceName = "Csps.Infrastructure.Passwords.common-passwords-10k.txt";

    private static readonly Lazy<FrozenSet<string>> Entries = new(Load);

    /// <summary>The number of distinct entries.</summary>
    internal static int Count => Entries.Value.Count;

    /// <inheritdoc />
    public bool IsCommon(string password)
    {
        ArgumentNullException.ThrowIfNull(password);
        return Entries.Value.Contains(password);
    }

    private static FrozenSet<string> Load()
    {
        using var stream = typeof(CommonPasswordList).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException("The embedded common-password list is missing from the assembly.");
        using var reader = new StreamReader(stream);

        var lines = new List<string>();
        while (reader.ReadLine() is { } line)
        {
            var entry = line.Trim();
            if (entry.Length > 0)
            {
                lines.Add(entry);
            }
        }

        return lines.ToFrozenSet(StringComparer.OrdinalIgnoreCase);
    }
}
