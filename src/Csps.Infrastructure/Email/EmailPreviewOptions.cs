using MimeKit;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Command-line options of <c>tools/Csps.EmailPreview</c> (D-30): either <c>--to</c>, which sends the eight sample emails
/// to one address, or <c>--out</c>, which writes them as files. Error messages never repeat an argument value.
/// </summary>
public sealed class EmailPreviewOptions
{
    /// <summary>One-line usage text.</summary>
    public const string Usage =
        "Usage: dotnet run --project tools/Csps.EmailPreview -- (--to <address> | --out <folder>) [--public-base-url <https://site>]. "
        + "Run it with DOTNET_ENVIRONMENT=Development in the terminal.";

    private const string ToFlag = "--to";
    private const string OutFlag = "--out";
    private const string BaseUrlFlag = "--public-base-url";

    private EmailPreviewOptions(string? to, string? outputFolder, string? publicBaseUrl)
    {
        To = to;
        OutputFolder = outputFolder;
        PublicBaseUrl = publicBaseUrl;
    }

    /// <summary>Gets the address that receives the sample emails, or null when writing files.</summary>
    public string? To { get; }

    /// <summary>Gets the folder the sample emails are written to, or null when sending.</summary>
    public string? OutputFolder { get; }

    /// <summary>Gets the site address the sample links point to, or null to use the <c>App:PublicBaseUrl</c> setting.</summary>
    public string? PublicBaseUrl { get; }

    /// <summary>Parses the arguments. Flags are case-sensitive.</summary>
    /// <param name="args">The arguments after <c>--</c>.</param>
    /// <returns>The options.</returns>
    /// <exception cref="ArgumentException">An argument is unknown, repeated or missing its value, or the address is not valid.</exception>
    public static EmailPreviewOptions Parse(string[] args)
    {
        ArgumentNullException.ThrowIfNull(args);

        string? to = null;
        string? outputFolder = null;
        string? baseUrl = null;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case ToFlag:
                    to = TakeValue(args, ref index, ToFlag, to);
                    break;
                case OutFlag:
                    outputFolder = TakeValue(args, ref index, OutFlag, outputFolder);
                    break;
                case BaseUrlFlag:
                    baseUrl = TakeValue(args, ref index, BaseUrlFlag, baseUrl);
                    break;
                default:
                    throw UnknownArgument(args[index]);
            }
        }

        if (to is null && outputFolder is null)
        {
            throw UsageError("Give --to <address> or --out <folder>.");
        }

        if (to is not null && outputFolder is not null)
        {
            throw UsageError("Give --to or --out, not both.");
        }

        if (to is not null && (!MailboxAddress.TryParse(to, out var address) || !address.Address.Contains('@', StringComparison.Ordinal)))
        {
            throw UsageError("--to must be an email address.");
        }

        return new EmailPreviewOptions(to, outputFolder, baseUrl);
    }

    /// <summary>Returns the type name only.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(EmailPreviewOptions);

    private static string TakeValue(string[] args, ref int index, string flag, string? current)
    {
        if (current is not null)
        {
            throw UsageError($"{flag} was given more than once.");
        }

        var valueIndex = index + 1;
        if (valueIndex >= args.Length
            || string.IsNullOrWhiteSpace(args[valueIndex])
            || args[valueIndex].StartsWith("--", StringComparison.Ordinal))
        {
            throw UsageError($"{flag} needs a value.");
        }

        index = valueIndex;
        return args[valueIndex];
    }

    // Names only the flag, never what follows "=" or the next argument: either could be a secret.
    private static ArgumentException UnknownArgument(string argument)
    {
        var flag = argument.StartsWith("--", StringComparison.Ordinal) ? argument.Split('=')[0] : null;
        return UsageError(flag is null ? "An unexpected value was given." : $"Unknown argument {flag}.");
    }

    private static ArgumentException UsageError(string message) => new($"{message} {Usage}");
}
