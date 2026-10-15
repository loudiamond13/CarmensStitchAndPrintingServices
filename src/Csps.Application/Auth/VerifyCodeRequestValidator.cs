using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Auth;

/// <summary>Checks the code form: exactly six digits, with the UI-SPEC message for an empty or incomplete code.</summary>
public sealed class VerifyCodeRequestValidator : AbstractValidator<VerifyCodeRequest>
{
    /// <summary>The message for a missing or incomplete code.</summary>
    public const string CodeIncomplete = "Enter all 6 digits.";

    /// <summary>Creates the validator.</summary>
    public VerifyCodeRequestValidator()
    {
        RuleFor(request => request.Code)
            .Must(static code => SixDigitCode.IsWellFormed(code)).WithMessage(CodeIncomplete);
    }
}
