using Csps.Application.Common;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation.Results;

namespace Csps.Application.Content;

/// <summary>The error values the site content use cases return (CONT-01). Codes start with <c>site-content.</c>.</summary>
public static class SiteContentErrors
{
    /// <summary>The machine code of a form that breaks field rules.</summary>
    public const string InvalidCode = "site-content.invalid-request";

    /// <summary>The machine code of a product line that does not exist.</summary>
    public const string LineNotFoundCode = "product-lines.not-found";

    /// <summary>The plain-English text for a product line that does not exist.</summary>
    public const string LineNotFoundMessage = "This product line wasn't found.";

    /// <summary>Gets the 404 for a product line that does not exist.</summary>
    public static Error LineNotFound { get; } = Error.NotFound(LineNotFoundCode, LineNotFoundMessage);

    /// <summary>The machine code of a testimonial that does not exist.</summary>
    public const string TestimonialNotFoundCode = "testimonials.not-found";

    /// <summary>The plain-English text for a testimonial that does not exist.</summary>
    public const string TestimonialNotFoundMessage = "This testimonial wasn't found.";

    /// <summary>Gets the 404 for a testimonial that does not exist.</summary>
    public static Error TestimonialNotFound { get; } = Error.NotFound(TestimonialNotFoundCode, TestimonialNotFoundMessage);

    /// <summary>The machine code of a photo slot that holds no photo.</summary>
    public const string PhotoNotFoundCode = "product-lines.photo-not-found";

    /// <summary>The plain-English text for a photo slot that holds no photo.</summary>
    public const string PhotoNotFoundMessage = "This product line has no photo there.";

    /// <summary>Gets the 404 for a photo slot that holds no photo.</summary>
    public static Error PhotoNotFound { get; } = Error.NotFound(PhotoNotFoundCode, PhotoNotFoundMessage);

    /// <summary>The machine code of a link preview picture removal when no picture is set.</summary>
    public const string SharePictureNotFoundCode = "site-settings.share-picture-not-found";

    /// <summary>The plain-English text for a link preview picture removal when no picture is set.</summary>
    public const string SharePictureNotFoundMessage = "There's no link preview picture to remove.";

    /// <summary>Gets the 404 for a link preview picture removal when no picture is set.</summary>
    public static Error SharePictureNotFound { get; } = Error.NotFound(SharePictureNotFoundCode, SharePictureNotFoundMessage);

    /// <summary>The machine code of a gallery item that does not exist, or is not an upload where an upload is needed.</summary>
    public const string GalleryItemNotFoundCode = "gallery-items.not-found";

    /// <summary>The plain-English text for a gallery item that does not exist.</summary>
    public const string GalleryItemNotFoundMessage = "This gallery item wasn't found.";

    /// <summary>Gets the 404 for a gallery item that does not exist, or for an order item where an upload is needed.</summary>
    public static Error GalleryItemNotFound { get; } = Error.NotFound(GalleryItemNotFoundCode, GalleryItemNotFoundMessage);

    /// <summary>Gets the 400 for a gallery upload filed under a product line that does not exist, under <c>productLineId</c>.</summary>
    public static Error GalleryLineUnknown { get; } = Error.Validation(
        InvalidCode,
        SiteSettings.InvalidMessage,
        new Dictionary<string, string[]>(StringComparer.Ordinal) { ["productLineId"] = [GalleryEntry.LineRequiredMessage] });

    /// <summary>Gets the 400 for a gallery photo replace that came with no file, under <c>file</c>.</summary>
    public static Error GalleryPhotoMissing { get; } = Error.Validation(
        InvalidCode,
        SiteSettings.InvalidMessage,
        new Dictionary<string, string[]>(StringComparer.Ordinal) { ["file"] = [GalleryEntry.PhotoRequiredMessage] });

    /// <summary>The machine code of a delete refused because something is filed under the product line.</summary>
    public const string LineInUseCode = "product-lines.in-use";

    /// <summary>The plain-English text for a delete refused because something is filed under the product line.</summary>
    public const string LineInUseMessage = "This product line is in use. Hide it instead.";

    /// <summary>Gets the 422 for a delete refused because a photo, a gallery item or an order product type is filed under the line.</summary>
    public static Error LineInUse { get; } = Error.BusinessRule(LineInUseCode, LineInUseMessage);

    /// <summary>The text for a short name another product line already uses.</summary>
    public const string ShortNameTakenMessage = "Another product line already uses this short name.";

    /// <summary>Gets the 400 for a short name another product line already uses, under <c>shortName</c>.</summary>
    public static Error ShortNameTaken { get; } = Error.Validation(
        InvalidCode,
        SiteSettings.InvalidMessage,
        new Dictionary<string, string[]>(StringComparer.Ordinal) { ["shortName"] = [ShortNameTakenMessage] });

    /// <summary>Gets the 400 for an order product type id that no longer exists, under <c>productTypeIds</c>. The form is stale, so the text is the shared reload line.</summary>
    public static Error ProductTypesUnknown { get; } = Error.Validation(
        InvalidCode,
        SiteSettings.InvalidMessage,
        new Dictionary<string, string[]>(StringComparer.Ordinal) { ["productTypeIds"] = [RowVersions.InvalidMessage] });

    /// <summary>Turns a failed validation into the 400 that names every broken field.</summary>
    /// <param name="validation">The failed validation.</param>
    /// <returns>The error.</returns>
    public static Error Invalid(ValidationResult validation) =>
        ValidationResults.ToError(validation, InvalidCode, SiteSettings.InvalidMessage);
}
