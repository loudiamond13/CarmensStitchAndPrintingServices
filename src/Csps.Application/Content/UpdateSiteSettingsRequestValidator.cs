using System.Linq.Expressions;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the Business Info form (OR-3, CONT-01), with the UI-SPEC messages. The browser checks the same rules before it
/// sends anything. Lengths count UTF-16 code units, the same unit as a JavaScript string length, and are taken after trimming. An
/// empty optional value is not set and is not checked. The email check uses no regular expression (CWE-1333).
/// </summary>
public sealed class UpdateSiteSettingsRequestValidator : AbstractValidator<UpdateSiteSettingsRequest>
{
    /// <summary>The longest business name.</summary>
    public const int BusinessNameMaxLength = 100;

    /// <summary>The message for a missing street.</summary>
    public const string StreetRequired = "Enter the street and barangay.";

    /// <summary>The message for a missing town or city.</summary>
    public const string TownOrCityRequired = "Enter the town or city.";

    /// <summary>The message for a missing province.</summary>
    public const string ProvinceRequired = "Enter the province.";

    /// <summary>The message for a business name over the limit.</summary>
    public const string BusinessNameTooLong = "Keep the business name to 100 characters or fewer.";

    /// <summary>The message for a postal code that is not four digits.</summary>
    public const string PostalCodeInvalid = "Use the 4-digit postal code, like 8600.";

    /// <summary>The message for a form with no phone number.</summary>
    public const string PhonesRequired = "Add at least one phone number.";

    /// <summary>The message for a list with no single main number.</summary>
    public const string MainPhoneRequired = "Choose the main number.";

    /// <summary>The message for a number listed twice.</summary>
    public const string PhoneDuplicate = "This number is already listed.";

    /// <summary>The message for a list of more than four numbers.</summary>
    public const string PhonesTooMany = "You can list up to 4 numbers.";

    private const int PostalCodeLength = 4;

    private const string PhonesKey = "Phones";

    /// <summary>Creates the validator.</summary>
    public UpdateSiteSettingsRequestValidator()
    {
        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);

        Required(request => request.BusinessName, BusinessNameMaxLength, SiteSettings.BusinessNameRequiredMessage, BusinessNameTooLong);
        Required(request => request.Tagline, SiteSettings.TaglineMaxLength, SiteSettings.TaglineRequiredMessage, SiteSettings.TaglineTooLongMessage);
        Optional(request => request.AboutText, SiteSettings.AboutTextMaxLength, LengthMessage(SiteSettings.AboutTextMaxLength));
        Optional(request => request.TurnaroundLine, SiteSettings.TurnaroundLineMaxLength, SiteSettings.TurnaroundLineTooLongMessage);
        Required(request => request.Street, SiteSettings.StreetMaxLength, StreetRequired, LengthMessage(SiteSettings.StreetMaxLength));
        Required(request => request.TownOrCity, SiteSettings.TownOrCityMaxLength, TownOrCityRequired, LengthMessage(SiteSettings.TownOrCityMaxLength));
        Required(request => request.Province, SiteSettings.ProvinceMaxLength, ProvinceRequired, LengthMessage(SiteSettings.ProvinceMaxLength));

        RuleFor(request => request.PostalCode)
            .Must(static code => IsNotSet(code) || IsPostalCode(code!.Trim())).WithMessage(PostalCodeInvalid);

        Link(request => request.DirectionsUrl, SiteLinks.IsDirectionsLink, SiteLinks.DirectionsInvalidMessage);
        Link(request => request.MapEmbedUrl, SiteLinks.IsMapEmbedLink, SiteLinks.MapEmbedInvalidMessage);
        Link(request => request.MessengerUrl, SiteLinks.IsMessengerLink, SiteLinks.MessengerInvalidMessage);
        Link(request => request.FacebookUrl, SiteLinks.IsFacebookLink, SiteLinks.FacebookInvalidMessage);
        Link(request => request.InstagramUrl, SiteLinks.IsInstagramLink, SiteLinks.InstagramInvalidMessage);
        Link(request => request.TiktokUrl, SiteLinks.IsTikTokLink, SiteLinks.TikTokInvalidMessage);

        RuleFor(request => request.ContactEmail)
            .Must(static email => IsNotSet(email) || IsEmail(email!.Trim())).WithMessage(SignInRequestValidator.EmailInvalid);

        RuleFor(request => request).Custom(static (request, context) => CheckPhones(request.Phones, context));
    }

    private static string LengthMessage(int max) => $"Keep this to {max} characters or fewer.";

    private static bool IsNotSet(string? value) => string.IsNullOrWhiteSpace(value);

    private static bool IsPostalCode(string code) => code.Length == PostalCodeLength && code.All(char.IsAsciiDigit);

    // The same shape check as every other email field, within the 254-character column, and never a bracket placeholder.
    private static bool IsEmail(string email) =>
        email.Length <= SiteSettings.ContactEmailMaxLength && SignInRequestValidator.IsEmailShaped(email) && !SiteLinks.HasBracketPlaceholder(email);

    private void Required(Expression<Func<UpdateSiteSettingsRequest, string?>> property, int max, string requiredMessage, string tooLongMessage) =>
        RuleFor(property).Custom((value, context) =>
        {
            var text = value?.Trim() ?? string.Empty;
            if (text.Length == 0)
            {
                context.AddFailure(requiredMessage);
            }
            else if (text.Length > max)
            {
                context.AddFailure(tooLongMessage);
            }
            else if (SiteLinks.HasBracketPlaceholder(text))
            {
                context.AddFailure(SiteLinks.PlaceholderTextMessage);
            }
        });

    private void Optional(Expression<Func<UpdateSiteSettingsRequest, string?>> property, int max, string tooLongMessage) =>
        RuleFor(property).Custom((value, context) =>
        {
            var text = value?.Trim() ?? string.Empty;
            if (text.Length > max)
            {
                context.AddFailure(tooLongMessage);
            }
            else if (SiteLinks.HasBracketPlaceholder(text))
            {
                context.AddFailure(SiteLinks.PlaceholderTextMessage);
            }
        });

    private void Link(Expression<Func<UpdateSiteSettingsRequest, string?>> property, Func<string?, bool> isAllowed, string message) =>
        RuleFor(property).Must(link => IsNotSet(link) || isAllowed(link!.Trim())).WithMessage(message);

    // Row errors are keyed "phones[i].number" or "phones[i].label"; list rules are keyed "phones".
    private static void CheckPhones(IReadOnlyList<PhoneEntry>? phones, ValidationContext<UpdateSiteSettingsRequest> context)
    {
        var rows = phones ?? [];
        if (rows.Count == 0)
        {
            Fail(context, PhonesKey, PhonesRequired);
            return;
        }

        if (rows.Count > SitePhoneNumber.MaxCount)
        {
            Fail(context, PhonesKey, PhonesTooMany);
        }

        if (rows.Count(static row => row?.IsMain == true) != 1)
        {
            Fail(context, PhonesKey, MainPhoneRequired);
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            if (!PhilippinePhone.TryParse(row?.Number, out var phone))
            {
                Fail(context, $"{PhonesKey}[{index}].Number", PhilippinePhone.InvalidMessage);
            }
            else if (!seen.Add(phone.E164))
            {
                Fail(context, $"{PhonesKey}[{index}].Number", PhoneDuplicate);
            }

            var label = row?.Label?.Trim();
            if (label?.Length > SitePhoneNumber.LabelMaxLength)
            {
                Fail(context, $"{PhonesKey}[{index}].Label", SitePhoneNumber.LabelTooLongMessage);
            }
            else if (SiteLinks.HasBracketPlaceholder(label))
            {
                Fail(context, $"{PhonesKey}[{index}].Label", SiteLinks.PlaceholderTextMessage);
            }
        }
    }

    private static void Fail(ValidationContext<UpdateSiteSettingsRequest> context, string path, string message) =>
        context.AddFailure(new ValidationFailure(path, message));
}
