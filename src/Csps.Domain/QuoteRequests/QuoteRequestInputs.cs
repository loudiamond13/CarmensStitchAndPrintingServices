namespace Csps.Domain.QuoteRequests;

/// <summary>What the visitor chose in the product list (D-24). The numbers are stored data and are never renumbered or reused.</summary>
public enum QuoteProductChoice : byte
{
    /// <summary>One of the shown product lines.</summary>
    Line = 1,

    /// <summary>"Custom design".</summary>
    Custom = 2,

    /// <summary>"Not sure yet".</summary>
    NotSure = 3,
}

/// <summary>The estimated quantity ranges the form offers (INQ-01). The numbers are stored data and are never renumbered or reused.</summary>
public enum QuoteQuantityRange : byte
{
    /// <summary>1 to 9 pieces.</summary>
    OneToNine = 1,

    /// <summary>10 to 20 pieces.</summary>
    TenToTwenty = 2,

    /// <summary>21 to 50 pieces.</summary>
    TwentyOneToFifty = 3,

    /// <summary>51 to 100 pieces.</summary>
    FiftyOneToHundred = 4,

    /// <summary>More than 100 pieces.</summary>
    HundredPlus = 5,
}

/// <summary>The wire keys of the product choices: <c>line</c>, <c>custom</c> and <c>not-sure</c>.</summary>
public static class QuoteProductChoiceNames
{
    private static readonly (QuoteProductChoice Choice, string Key)[] Pairs =
    [
        (QuoteProductChoice.Line, "line"),
        (QuoteProductChoice.Custom, "custom"),
        (QuoteProductChoice.NotSure, "not-sure"),
    ];

    /// <summary>Gets the key of a choice.</summary>
    /// <param name="choice">The choice.</param>
    /// <returns>For example <c>not-sure</c> for <see cref="QuoteProductChoice.NotSure"/>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The number is not one of the three.</exception>
    public static string ToKey(QuoteProductChoice choice)
    {
        foreach (var (known, key) in Pairs)
        {
            if (known == choice)
            {
                return key;
            }
        }

        throw new ArgumentOutOfRangeException(nameof(choice), choice, "Unknown product choice.");
    }

    /// <summary>Reads a key exactly, ignoring only spaces around it.</summary>
    /// <param name="text">The text sent by a client.</param>
    /// <param name="choice">The choice when the text is one of the three keys.</param>
    /// <returns>True when the text names a choice.</returns>
    public static bool TryParse(string? text, out QuoteProductChoice choice)
    {
        foreach (var (known, key) in Pairs)
        {
            if (string.Equals(text?.Trim(), key, StringComparison.Ordinal))
            {
                choice = known;
                return true;
            }
        }

        choice = default;
        return false;
    }
}

/// <summary>The wire keys of the quantity ranges: <c>1-9</c>, <c>10-20</c>, <c>21-50</c>, <c>51-100</c> and <c>100+</c>.</summary>
public static class QuoteQuantityRangeNames
{
    private static readonly (QuoteQuantityRange Range, string Key)[] Pairs =
    [
        (QuoteQuantityRange.OneToNine, "1-9"),
        (QuoteQuantityRange.TenToTwenty, "10-20"),
        (QuoteQuantityRange.TwentyOneToFifty, "21-50"),
        (QuoteQuantityRange.FiftyOneToHundred, "51-100"),
        (QuoteQuantityRange.HundredPlus, "100+"),
    ];

    /// <summary>Gets the key of a range.</summary>
    /// <param name="range">The range.</param>
    /// <returns>For example <c>100+</c> for <see cref="QuoteQuantityRange.HundredPlus"/>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The number is not one of the five.</exception>
    public static string ToKey(QuoteQuantityRange range)
    {
        foreach (var (known, key) in Pairs)
        {
            if (known == range)
            {
                return key;
            }
        }

        throw new ArgumentOutOfRangeException(nameof(range), range, "Unknown quantity range.");
    }

    /// <summary>Reads a key exactly, ignoring only spaces around it.</summary>
    /// <param name="text">The text sent by a client.</param>
    /// <param name="range">The range when the text is one of the five keys.</param>
    /// <returns>True when the text names a range.</returns>
    public static bool TryParse(string? text, out QuoteQuantityRange range)
    {
        foreach (var (known, key) in Pairs)
        {
            if (string.Equals(text?.Trim(), key, StringComparison.Ordinal))
            {
                range = known;
                return true;
            }
        }

        range = default;
        return false;
    }
}

/// <summary>What a visitor's quote form carries into the domain, before the rules clean it.</summary>
/// <param name="CustomerName">The visitor's name.</param>
/// <param name="TeamName">The team or organization; none when null or empty.</param>
/// <param name="ContactNumber">The mobile number as typed; the domain stores it as E.164.</param>
/// <param name="Email">The email address; none when null or empty.</param>
/// <param name="ProductChoice">What the visitor chose in the product list; none when null.</param>
/// <param name="ProductLineId">The chosen line, when the choice is <see cref="QuoteProductChoice.Line"/>.</param>
/// <param name="ProductTitle">The title of the chosen line at the moment of the request (D-24).</param>
/// <param name="QuantityRange">The estimated quantity; none when null.</param>
/// <param name="Message">What the visitor wrote; none when null or empty.</param>
public sealed record QuoteRequestInput(
    string CustomerName,
    string? TeamName,
    string ContactNumber,
    string? Email,
    QuoteProductChoice? ProductChoice = null,
    Guid? ProductLineId = null,
    string? ProductTitle = null,
    QuoteQuantityRange? QuantityRange = null,
    string? Message = null);
