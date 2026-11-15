using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the testimonial form (OR-3, CONT-03), with the UI-SPEC messages. They are the domain's own rules
/// (<see cref="Testimonial.Check"/>), so the browser, the validator and the domain never disagree. An edit is marked with
/// <see cref="EditKey"/> in <see cref="ValidationContext{T}.RootContextData"/>: the version is then required.
/// </summary>
public sealed class TestimonialRequestValidator : AbstractValidator<TestimonialRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that marks an edit.</summary>
    public const string EditKey = "edit";

    /// <summary>Creates the validator.</summary>
    public TestimonialRequestValidator()
    {
        RuleFor(request => request).Custom(CheckForm);
    }

    private static void CheckForm(TestimonialRequest request, ValidationContext<TestimonialRequest> context)
    {
        if (context.RootContextData.ContainsKey(EditKey) && !RowVersions.TryParse(request.Version, out _))
        {
            context.AddFailure(nameof(TestimonialRequest.Version), RowVersions.InvalidMessage);
        }

        foreach (var (field, messages) in Testimonial.Check(request.ToValues()))
        {
            context.AddFailure(field, messages[0]);
        }
    }
}

/// <summary>The rule of the testimonial move form: the direction is "up" or "down".</summary>
public sealed class MoveTestimonialRequestValidator : AbstractValidator<MoveTestimonialRequest>
{
    /// <summary>Creates the validator.</summary>
    public MoveTestimonialRequestValidator()
    {
        RuleFor(request => request.Direction)
            .Must(static direction => MoveProductLineRequestValidator.IsDirection(direction))
            .WithMessage(SiteSettings.InvalidMessage);
    }
}
