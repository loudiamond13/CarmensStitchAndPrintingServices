using System.Diagnostics.CodeAnalysis;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Orders;

namespace Csps.Domain.QuoteRequests;

/// <summary>
/// The limits and plain-English field messages of a quote request (INQ-01), shared by the domain, the validator and the tests so
/// every layer says the same words. Lengths are UTF-16 code units after trimming, the same measure as a browser string length. The
/// limits are the order limits, so a saved request always fits the New Order form later.
/// </summary>
public static class QuoteRequestRules
{
    /// <summary>The longest visitor name.</summary>
    public const int CustomerNameMaxLength = OrderRules.CustomerNameMaxLength;

    /// <summary>The longest team name.</summary>
    public const int TeamNameMaxLength = OrderRules.TeamNameMaxLength;

    /// <summary>The longest mobile number a visitor may type.</summary>
    public const int ContactNumberMaxLength = OrderRules.ContactNumberMaxLength;

    /// <summary>The longest stored mobile number: <c>+63</c> and ten digits.</summary>
    public const int ContactNumberE164MaxLength = 13;

    /// <summary>The longest email address.</summary>
    public const int EmailMaxLength = OrderRules.EmailMaxLength;

    /// <summary>The longest message, the same as the order notes.</summary>
    public const int MessageMaxLength = OrderRules.NotesMaxLength;

    /// <summary>The longest stored product title: the product line title limit.</summary>
    public const int ProductTitleMaxLength = ProductLine.TitleMaxLength;

    /// <summary>The most photos one request may declare (D-02).</summary>
    public const int MaxPhotos = 5;

    /// <summary>The longest photo file name a visitor may declare.</summary>
    public const int PhotoNameMaxLength = 255;

    /// <summary>The size of an upload key in bytes before it is written as base64url text.</summary>
    public const int UploadKeyBytes = 32;

    /// <summary>The size of the stored SHA-256 of an upload key in bytes.</summary>
    public const int UploadKeyHashLength = 32;

    /// <summary>The machine code of a quote form that breaks field rules.</summary>
    public const string InvalidCode = "quote-requests.validation";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The field name of the visitor name.</summary>
    public const string CustomerNameField = "customerName";

    /// <summary>The field name of the team name.</summary>
    public const string TeamNameField = "teamName";

    /// <summary>The field name of the mobile number.</summary>
    public const string ContactNumberField = "contactNumber";

    /// <summary>The field name of the email.</summary>
    public const string EmailField = "email";

    /// <summary>The field name of the product choice.</summary>
    public const string ProductChoiceField = "productChoice";

    /// <summary>The field name of the chosen product line key.</summary>
    public const string ProductLineKeyField = "productLineKey";

    /// <summary>The field name of the quantity range.</summary>
    public const string QuantityField = "quantity";

    /// <summary>The field name of the message.</summary>
    public const string MessageField = "message";

    /// <summary>The field name of the declared photo file names.</summary>
    public const string PhotosField = "photos";

    /// <summary>The field name of the upload key.</summary>
    public const string UploadKeyField = "uploadKey";

    /// <summary>The message for a missing name.</summary>
    public const string CustomerNameRequired = "Enter your name.";

    /// <summary>The message for a name over the limit.</summary>
    public const string CustomerNameTooLong = "Keep your name to 100 characters or fewer.";

    /// <summary>The message for a team name over the limit.</summary>
    public const string TeamNameTooLong = "Keep the team name to 100 characters or fewer.";

    /// <summary>The message for a missing number or a number that is not a Philippine mobile number.</summary>
    public const string ContactNumberInvalid = "Enter a mobile number, like 0917 123 4567.";

    /// <summary>The message for an email that is not an address.</summary>
    public const string EmailInvalid = "Enter a valid email, like name@gmail.com";

    /// <summary>The message for an email over the limit.</summary>
    public const string EmailTooLong = "Keep the email to 254 characters or fewer.";

    /// <summary>The message for a product choice that is not in the list.</summary>
    public const string ProductInvalid = "Choose a product from the list.";

    /// <summary>The message for a quantity that is not one of the ranges.</summary>
    public const string QuantityInvalid = "Choose a quantity from the list.";

    /// <summary>The message for a message over the limit.</summary>
    public const string MessageTooLong = "Keep your message to 2,000 characters or fewer.";

    /// <summary>The message for more photos than the limit (UI-SPEC Validation).</summary>
    public const string PhotosTooMany = "You can send up to 5 photos.";

    /// <summary>The message for a photo list that cannot be declared: empty, or declared a second time.</summary>
    public const string PhotosInvalid = "Photos could not be attached. Try sending them again.";

    /// <summary>The message for a photo file name over the limit.</summary>
    public const string PhotoNameTooLong = "Keep each photo file name to 255 characters or fewer.";

    /// <summary>The machine code of a photo the server refuses by its content (UI-SPEC Validation).</summary>
    public const string PhotoRefusedCode = "quote-requests.photo-refused";

    /// <summary>The message for a file that is not a photo we can take; <c>{0}</c> is the cleaned file name.</summary>
    public const string PhotoTypeFormat = "{0} isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.";

    /// <summary>The message for a file over 10 MB; <c>{0}</c> is the cleaned file name.</summary>
    public const string PhotoTooLargeFormat = "{0} is over 10 MB. Send a smaller photo, or send it on Messenger.";

    /// <summary>The message for a photo over the pixel or side limit; <c>{0}</c> is the cleaned file name.</summary>
    public const string PhotoTooBigFormat = "{0} is too big. Photos can be at most 25 megapixels.";

    /// <summary>The message for a missing or malformed upload key.</summary>
    public const string UploadKeyInvalid = "Photos could not be attached. Try sending them again.";

    /// <summary>Cleans a photo file name the visitor declared: no folders, no control characters, trimmed.</summary>
    /// <param name="fileName">The name as the browser reported it.</param>
    /// <param name="slot">The place of the photo, used to name a photo whose name is empty once cleaned.</param>
    /// <returns>The cleaned name, or <c>Photo {n}</c> when nothing is left.</returns>
    public static string CleanPhotoName(string fileName, int slot)
    {
        ArgumentNullException.ThrowIfNull(fileName);
        var cut = fileName.LastIndexOfAny(['/', '\\']);
        var leaf = cut >= 0 ? fileName[(cut + 1)..] : fileName;
        var cleaned = new string([.. leaf.Where(static character => !char.IsControl(character))]).Trim();
        return cleaned.Length == 0 ? $"Photo {slot + 1}" : cleaned;
    }

    /// <summary>Tells whether text is a Philippine mobile number within the length cap.</summary>
    /// <param name="text">The text as typed, trimmed.</param>
    /// <param name="phone">The parsed number when this returns true.</param>
    /// <returns>True for a mobile number such as <c>0917 123 4567</c> or <c>+63 917 123 4567</c>.</returns>
    public static bool TryParseMobile(string text, [NotNullWhen(true)] out PhilippinePhone? phone)
    {
        ArgumentNullException.ThrowIfNull(text);
        phone = null;
        return text.Length <= ContactNumberMaxLength && PhilippinePhone.TryParse(text, out phone) && phone.IsMobile;
    }

    /// <summary>Checks and cleans a quote form, returning the first broken rule.</summary>
    /// <param name="input">The form as given.</param>
    /// <returns>The form with text trimmed, empty optional text turned into null and the number as E.164, or a validation error naming the first broken field.</returns>
    public static Result<QuoteRequestInput> Check(QuoteRequestInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(input.CustomerName);
        ArgumentNullException.ThrowIfNull(input.ContactNumber);

        var customerName = input.CustomerName.Trim();
        if (customerName.Length == 0)
        {
            return Reject<QuoteRequestInput>(CustomerNameField, CustomerNameRequired);
        }

        if (customerName.Length > CustomerNameMaxLength)
        {
            return Reject<QuoteRequestInput>(CustomerNameField, CustomerNameTooLong);
        }

        var teamName = Clean(input.TeamName);
        if (teamName is { Length: > TeamNameMaxLength })
        {
            return Reject<QuoteRequestInput>(TeamNameField, TeamNameTooLong);
        }

        if (!TryParseMobile(input.ContactNumber.Trim(), out var phone))
        {
            return Reject<QuoteRequestInput>(ContactNumberField, ContactNumberInvalid);
        }

        var email = Clean(input.Email);
        if (email is { Length: > EmailMaxLength })
        {
            return Reject<QuoteRequestInput>(EmailField, EmailTooLong);
        }

        if (email is not null && !OrderRules.IsValidEmail(email))
        {
            return Reject<QuoteRequestInput>(EmailField, EmailInvalid);
        }

        var product = CheckProduct(input);
        if (product.IsFailure)
        {
            return Result.Failure<QuoteRequestInput>(product.Error);
        }

        if (input.QuantityRange is { } range && !Enum.IsDefined(range))
        {
            return Reject<QuoteRequestInput>(QuantityField, QuantityInvalid);
        }

        var message = Clean(input.Message);
        if (message is { Length: > MessageMaxLength })
        {
            return Reject<QuoteRequestInput>(MessageField, MessageTooLong);
        }

        return Result.Success(input with
        {
            CustomerName = customerName,
            TeamName = teamName,
            ContactNumber = phone.E164,
            Email = email,
            ProductTitle = product.Value,
            Message = message,
        });
    }

    /// <summary>Builds a validation error for one field.</summary>
    /// <typeparam name="T">The result type.</typeparam>
    /// <param name="field">The field name.</param>
    /// <param name="message">The plain-English message.</param>
    /// <returns>A failed result.</returns>
    public static Result<T> Reject<T>(string field, string message) =>
        Result.Failure<T>(Error.Validation(InvalidCode, InvalidMessage, new Dictionary<string, string[]> { [field] = [message] }));

    /// <summary>Builds a validation error for one field, for a use case that returns no value.</summary>
    /// <param name="field">The field name.</param>
    /// <param name="message">The plain-English message.</param>
    /// <returns>A failed result.</returns>
    public static Result Reject(string field, string message) =>
        Result.Failure(Error.Validation(InvalidCode, InvalidMessage, new Dictionary<string, string[]> { [field] = [message] }));

    // A line choice needs a line and its title; any other choice, or none, carries neither. Returns the cleaned title.
    private static Result<string?> CheckProduct(QuoteRequestInput input)
    {
        var title = Clean(input.ProductTitle);
        if (input.ProductChoice is { } choice && !Enum.IsDefined(choice))
        {
            return Reject<string?>(ProductChoiceField, ProductInvalid);
        }

        if (input.ProductChoice == QuoteProductChoice.Line)
        {
            return input.ProductLineId is null || title is null || title.Length > ProductTitleMaxLength
                ? Reject<string?>(ProductLineKeyField, ProductInvalid)
                : Result.Success<string?>(title);
        }

        return input.ProductLineId is not null || title is not null
            ? Reject<string?>(ProductChoiceField, ProductInvalid)
            : Result.Success<string?>(null);
    }

    // Trims, and turns empty text into null.
    private static string? Clean(string? text)
    {
        var trimmed = text?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
