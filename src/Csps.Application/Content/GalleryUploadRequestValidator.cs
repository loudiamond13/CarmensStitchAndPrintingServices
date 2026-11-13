using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the gallery upload form (OR-3, GAL-03), with the UI-SPEC messages. They are the domain's own rules
/// (<see cref="GalleryEntry.Check"/>), so the browser, the validator and the domain never disagree. An edit is marked with
/// <see cref="EditKey"/> in <see cref="ValidationContext{T}.RootContextData"/>: the version is then required. An add that came with no
/// photo is marked with <see cref="PhotoMissingKey"/>: the photo is then reported under <c>file</c>.
/// </summary>
public sealed class GalleryUploadRequestValidator : AbstractValidator<GalleryUploadRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that marks an edit.</summary>
    public const string EditKey = "edit";

    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that marks an add with no photo.</summary>
    public const string PhotoMissingKey = "photo-missing";

    /// <summary>The form field the photo is reported under.</summary>
    public const string FileField = "file";

    /// <summary>Creates the validator.</summary>
    public GalleryUploadRequestValidator()
    {
        RuleFor(request => request).Custom(CheckForm);
    }

    private static void CheckForm(GalleryUploadRequest request, ValidationContext<GalleryUploadRequest> context)
    {
        if (context.RootContextData.ContainsKey(PhotoMissingKey))
        {
            context.AddFailure(FileField, GalleryEntry.PhotoRequiredMessage);
        }

        if (context.RootContextData.ContainsKey(EditKey) && !RowVersions.TryParse(request.Version, out _))
        {
            context.AddFailure(nameof(GalleryUploadRequest.Version), RowVersions.InvalidMessage);
        }

        foreach (var (field, messages) in GalleryEntry.Check(request.ToValues()))
        {
            context.AddFailure(field, messages[0]);
        }
    }
}
