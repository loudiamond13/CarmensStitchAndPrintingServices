#if CSPS_TESTING
namespace Csps.Server.Testing;

/// <summary>Loads the developer's user-secrets into the Testing environment when the Playwright host asks (D-37). Debug builds only.</summary>
public static class TestingConfiguration
{
    /// <summary>The setting that turns user-secrets on in the Testing environment. Only the Playwright host sets it.</summary>
    public const string LoadUserSecretsKey = "Csps:Testing:LoadUserSecrets";

    /// <summary>Adds the Program assembly's user-secrets when the host runs as Testing and <see cref="LoadUserSecretsKey"/> is true.</summary>
    /// <param name="builder">The web application builder.</param>
    /// <param name="args">The command-line arguments.</param>
    public static void AddUserSecretsWhenAsked(WebApplicationBuilder builder, string[] args)
    {
        ArgumentNullException.ThrowIfNull(builder);

        if (builder.Environment.IsEnvironment("Testing") && builder.Configuration.GetValue<bool>(LoadUserSecretsKey))
        {
            AddUserSecrets(builder.Configuration, args, static sources => sources.AddUserSecrets<Program>(optional: true));
        }
    }

    /// <summary>
    /// Adds the secrets source, then re-adds environment variables and the command line after it, so both keep the
    /// highest precedence over user-secrets.
    /// </summary>
    /// <param name="configuration">The configuration to extend.</param>
    /// <param name="args">The command-line arguments.</param>
    /// <param name="addSecrets">Adds the user-secrets source; a test passes a stand-in.</param>
    public static void AddUserSecrets(ConfigurationManager configuration, string[] args, Action<IConfigurationBuilder> addSecrets)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(addSecrets);

        addSecrets(configuration);
        configuration.AddEnvironmentVariables();
        configuration.AddCommandLine(args);
    }
}
#endif
