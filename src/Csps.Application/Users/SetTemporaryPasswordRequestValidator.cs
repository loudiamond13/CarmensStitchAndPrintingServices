using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Checks the Set Temporary Password form with the rule the browser also applies (OR-3): the basic rule only (04 D-21: length 8 to 64,
/// no control characters, a number, a symbol). There is no name, breach or common-password check at this step, because the person must
/// replace the password with a fully checked one at their next sign-in.
/// </summary>
public sealed class SetTemporaryPasswordRequestValidator : AbstractValidator<SetTemporaryPasswordRequest>
{
    /// <summary>Creates the validator.</summary>
    public SetTemporaryPasswordRequestValidator()
    {
        RuleFor(request => request.TemporaryPassword).MustMeetBasicRule();
    }
}

/// <summary>The basic rule for a temporary password, shared by Add User and Set Temporary Password so the two can never disagree.</summary>
internal static class TemporaryPasswordRule
{
    /// <summary>The message for a missing temporary password.</summary>
    public const string Required = "Enter a temporary password.";

    /// <summary>Requires a password that meets the basic rule, with one message for the first rule it breaks.</summary>
    /// <typeparam name="T">The form type.</typeparam>
    /// <param name="rule">The rule for the password property.</param>
    /// <returns>The same rule builder.</returns>
    public static IRuleBuilderOptionsConditions<T, string?> MustMeetBasicRule<T>(this IRuleBuilder<T, string?> rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        return rule.Custom(static (password, context) =>
        {
            var failure = string.IsNullOrEmpty(password) ? PasswordRuleFailure.Empty : PasswordPolicy.CheckComposition(password);
            if (failure is { } broken)
            {
                context.AddFailure(broken == PasswordRuleFailure.Empty ? Required : PasswordPolicy.MessageFor(broken));
            }
        });
    }
}
