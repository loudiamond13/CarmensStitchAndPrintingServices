using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Identity;

/// <summary>Registers staff accounts on ASP.NET Core Identity.</summary>
public static class IdentityRegistration
{
    // The one place the schema version is chosen: AddCspsIdentity applies it to the host, ModelServices to the
    // design-time and test contexts, so the migrations and the runtime model never disagree.
    private static void ConfigureStores(StoreOptions stores) =>
        // Version 3 maps the passkey table with a JSON column, which the schema forbids (D-13 of Phase 1).
        stores.SchemaVersion = IdentitySchemaVersions.Version2;

    /// <summary>The services Identity reads while it builds the EF model when there is no host.</summary>
    internal static IServiceProvider ModelServices { get; } = new ServiceCollection()
        .Configure<IdentityOptions>(options => ConfigureStores(options.Stores))
        .BuildServiceProvider();

    /// <summary>
    /// Adds Identity with roles and the EF stores on <see cref="CspsDbContext"/>. The password rule itself lives in
    /// <c>PasswordPolicy</c> and the handlers, so the options here only keep Identity out of the way. Register
    /// <see cref="CspsDbContext"/> first (<c>AddCspsPersistence</c>).
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsIdentity(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        // No token providers and no sign-in manager: the sign-in manager answers a locked account before hashing,
        // which is a timing oracle (CWE-204). Handlers call IUserAccounts instead.
        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredUniqueChars = 1;
                ConfigureStores(options.Stores);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<CspsDbContext>();

        services.AddScoped<IUserAccounts, UserAccounts>();

        // The code key is a secret (AUTH-03): the host stops at start when it is missing or too short.
        services.AddOptions<AuthSecretsOptions>()
            .BindConfiguration(AuthSecretsOptions.SectionName)
            .Validate(static options => options.TryGetCodeMacKeyBytes(out _), AuthSecretsOptions.CodeMacKeyInvalidMessage)
            .ValidateOnStart();
        services.AddScoped<ITwoFactorChallenges, TwoFactorChallengeStore>();
        services.AddScoped<IAccountTokens, AccountTokenStore>();
        services.AddScoped<ISessions, SessionStore>();
        services.AddSingleton<ISessionCache, SessionCache>();
        services.AddSingleton<ICodeMac, HmacCodeMac>();
        services.AddSingleton<ISecureRandom, SecureRandom>();
#if CSPS_TESTING
        services.AddScoped<TestingAccountActivation>();
#endif

        return services;
    }
}
