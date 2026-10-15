using Csps.Application.Auth;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the sign-in settings and validators (AUTH-01 to AUTH-07).</summary>
public static class AuthRegistration
{
    /// <summary>
    /// Binds the <c>Auth</c> section into <see cref="AuthSettings"/> (the defaults are the approved limits), refuses to
    /// start with an unusable value, and registers the request validators (FluentValidation core only).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The host configuration.</param>
    /// <returns>The same service collection.</returns>
    /// <exception cref="InvalidOperationException">A setting is not usable; the message names the setting, never a value.</exception>
    public static IServiceCollection AddCspsAuth(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var settings = configuration.GetSection(AuthSettings.SectionName).Get<AuthSettings>() ?? new AuthSettings();
        var problems = settings.Validate();
        if (problems.Count > 0)
        {
            throw new InvalidOperationException(string.Join(" ", problems));
        }

        services.AddSingleton(settings);
        services.AddSingleton<IValidator<SignInRequest>, SignInRequestValidator>();
        services.AddSingleton<IValidator<VerifyCodeRequest>, VerifyCodeRequestValidator>();
        services.AddSingleton<IValidator<ForgotPasswordRequest>, ForgotPasswordRequestValidator>();
        services.AddSingleton<IValidator<ResetPasswordRequest>, ResetPasswordRequestValidator>();
        services.AddSingleton<IValidator<SetNewPasswordRequest>, SetNewPasswordRequestValidator>();
        return services;
    }
}
