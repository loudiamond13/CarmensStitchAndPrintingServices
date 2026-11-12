using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the Business Info form (OR-3, CONT-01), with the UI-SPEC messages. The browser checks the same rules before it
/// sends anything. Lengths count UTF-16 code units, the same unit as a JavaScript string length.
/// </summary>
public sealed class UpdateSiteSettingsRequestValidator : AbstractValidator<UpdateSiteSettingsRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateSiteSettingsRequestValidator()
    {
        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);

        RuleFor(request => request.Tagline)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(SiteSettings.TaglineRequiredMessage)
            .Must(static text => text!.Trim().Length <= SiteSettings.TaglineMaxLength).WithMessage(SiteSettings.TaglineTooLongMessage);
    }
}
