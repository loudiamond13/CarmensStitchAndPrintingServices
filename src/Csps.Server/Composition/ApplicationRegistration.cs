using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Profile;
using Csps.Application.Users;

namespace Csps.Server.Composition;

/// <summary>Registers the Application use cases: one handler class per use case, no mediator (PRD section 3.3).</summary>
public static class ApplicationRegistration
{
    /// <summary>Adds every use-case handler as a scoped service.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<GetSiteSettingsHandler>();
        services.AddScoped<SignInHandler>();
        services.AddScoped<VerifyCodeHandler>();
        services.AddScoped<ResendCodeHandler>();
        services.AddScoped<SessionIssuer>();
        services.AddScoped<RefreshHandler>();
        services.AddScoped<SignOutHandler>();
        services.AddScoped<SignOutOthersHandler>();
        services.AddScoped<ListSessionsHandler>();
        services.AddScoped<RevokeSessionHandler>();
        services.AddScoped<ForgotPasswordHandler>();
        services.AddScoped<CheckResetLinkHandler>();
        services.AddScoped<ResetPasswordHandler>();
        services.AddScoped<SetNewPasswordHandler>();
        services.AddScoped<CheckSetNewPasswordHandler>();
        services.AddScoped<CheckInviteHandler>();
        services.AddScoped<AcceptInviteHandler>();
        services.AddScoped<BootstrapManagerHandler>();
        services.AddScoped<GetProfileHandler>();
        services.AddScoped<UpdateProfileNameHandler>();
        services.AddScoped<CurrentPasswordCheck>();
        services.AddScoped<ChangePasswordHandler>();
        services.AddScoped<RequestEmailChangeHandler>();
        services.AddScoped<ConfirmEmailChangeHandler>();
        services.AddScoped<CheckEmailChangeHandler>();
        services.AddScoped<ResendEmailChangeHandler>();
        services.AddScoped<CancelEmailChangeHandler>();
        services.AddScoped<ListUsersHandler>();
        services.AddScoped<GetUserHandler>();
        services.AddScoped<CreateUserHandler>();
        services.AddScoped<ManagerGuard>();
        services.AddScoped<DeactivateUserHandler>();
        services.AddScoped<ActivateUserHandler>();
        return services;
    }
}
