namespace Csps.LegacyFitCheck.Findings;

/// <summary>The outcome of the privacy self-check.</summary>
internal enum PrivacyVerdict
{
    /// <summary>No personal value was found in the summary.</summary>
    Clean,

    /// <summary>The summary holds a value the run read, so it must not be written.</summary>
    HeldPersonalValue,
}

/// <summary>
/// The last guard before the counts-only summary is written (D-02): it looks for every personal-ish text the run read. A read value
/// shorter than three characters is too short to search for, a value that is an allowed list word may appear, and a value only
/// counts when it stands as a whole word (D-21). Any peso sign also refuses, because amounts stay in _local (D-08).
/// </summary>
internal static class PrivacySelfCheck
{
    private const int MinimumLength = 3;
    private const char PesoSign = '₱';

    /// <summary>Checks the rendered summary against the values the run read.</summary>
    /// <param name="renderedSummary">The summary text.</param>
    /// <param name="readValues">Every personal-ish value the run read.</param>
    /// <param name="allowedWords">The list words that may appear in the summary.</param>
    /// <returns>Refused when any read value appears in the summary as a whole word (any letter case), or a peso sign appears.</returns>
    public static PrivacyVerdict Check(string renderedSummary, IEnumerable<string?> readValues, IEnumerable<string> allowedWords)
    {
        ArgumentNullException.ThrowIfNull(renderedSummary);
        ArgumentNullException.ThrowIfNull(readValues);
        ArgumentNullException.ThrowIfNull(allowedWords);

        if (renderedSummary.Contains(PesoSign, StringComparison.Ordinal))
        {
            return PrivacyVerdict.HeldPersonalValue;
        }

        var allowed = new HashSet<string>(allowedWords.Select(static word => word.Trim()), StringComparer.OrdinalIgnoreCase);
        foreach (var value in readValues.Select(static value => value?.Trim()).Where(static value => value is { Length: >= MinimumLength }).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!allowed.Contains(value!) && ContainsAsWholeWord(renderedSummary, value!))
            {
                return PrivacyVerdict.HeldPersonalValue;
            }
        }

        return PrivacyVerdict.Clean;
    }

    // A hit counts only when the characters just outside it are not letters or digits (D-21). A value that starts or ends with
    // punctuation is already bounded on that side, so it needs no check there.
    private static bool ContainsAsWholeWord(string text, string value)
    {
        var checkBefore = char.IsLetterOrDigit(value[0]);
        var checkAfter = char.IsLetterOrDigit(value[^1]);
        var from = 0;
        while (from <= text.Length - value.Length)
        {
            var at = text.IndexOf(value, from, StringComparison.OrdinalIgnoreCase);
            if (at < 0)
            {
                return false;
            }

            var end = at + value.Length;
            if ((!checkBefore || at == 0 || !char.IsLetterOrDigit(text[at - 1])) && (!checkAfter || end == text.Length || !char.IsLetterOrDigit(text[end])))
            {
                return true;
            }

            from = at + 1;
        }

        return false;
    }
}
