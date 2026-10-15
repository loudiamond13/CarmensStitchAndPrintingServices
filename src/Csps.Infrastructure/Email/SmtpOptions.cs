using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>The two SMTP security modes. Both require TLS; there is no plain or opportunistic mode (D-26).</summary>
public enum SmtpSecurity
{
    /// <summary>Connect in plain text, then require an upgrade with STARTTLS (usually port 587).</summary>
    StartTls,

    /// <summary>Start TLS as soon as the connection opens (usually port 465).</summary>
    SslOnConnect,
}

/// <summary>
/// The mailbox the app sends from (<c>Smtp</c> section). These are secrets: they come only from user-secrets in
/// Development (<c>tools/scripts/Initialize-DevSecrets.ps1 -Smtp</c>) and from the host settings in Production, never
/// from a file in git. The API refuses to start without them, except in the Testing environment.
/// </summary>
public sealed class SmtpOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Smtp";

    /// <summary>The advice appended to every failure message.</summary>
    public const string FixAdvice =
        "See docs/operations/mail-setup.md. In Development run tools/scripts/Initialize-DevSecrets.ps1 -Smtp; in Production set them in the host settings.";

    /// <summary>Gets or sets the SMTP server name; it must match the server's certificate.</summary>
    public string Host { get; set; } = string.Empty;

    /// <summary>Gets or sets the SMTP port.</summary>
    public int Port { get; set; } = 587;

    /// <summary>
    /// Gets or sets the security mode, <c>StartTls</c> or <c>SslOnConnect</c> exactly. It is read as text so that an
    /// unsupported value fails the start-up check with a message that never repeats it.
    /// </summary>
    public string Security { get; set; } = nameof(SmtpSecurity.StartTls);

    /// <summary>Gets or sets the mailbox user name.</summary>
    public string UserName { get; set; } = string.Empty;

    /// <summary>Gets or sets the mailbox password. A secret.</summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>Reads <see cref="Security"/> as one of the two supported modes.</summary>
    /// <param name="security">The mode when the text is supported.</param>
    /// <returns>True when <see cref="Security"/> is exactly <c>StartTls</c> or <c>SslOnConnect</c>.</returns>
    public bool TryGetSecurity(out SmtpSecurity security)
    {
        switch (Security)
        {
            case nameof(SmtpSecurity.StartTls):
                security = SmtpSecurity.StartTls;
                return true;
            case nameof(SmtpSecurity.SslOnConnect):
                security = SmtpSecurity.SslOnConnect;
                return true;
            default:
                security = default;
                return false;
        }
    }

    internal sealed class Validator : IValidateOptions<SmtpOptions>
    {
        private const int MaximumPort = 65535;

        public ValidateOptionsResult Validate(string? name, SmtpOptions options)
        {
            ArgumentNullException.ThrowIfNull(options);

            var problems = new List<string>();
            if (string.IsNullOrWhiteSpace(options.Host))
            {
                problems.Add("Smtp:Host is not configured.");
            }

            if (options.Port is < 1 or > MaximumPort)
            {
                problems.Add("Smtp:Port must be a number from 1 to 65535.");
            }

            if (!options.TryGetSecurity(out _))
            {
                problems.Add("Smtp:Security must be StartTls or SslOnConnect. Mail without TLS is not allowed (D-26).");
            }

            if (string.IsNullOrWhiteSpace(options.UserName))
            {
                problems.Add("Smtp:UserName is not configured.");
            }

            if (string.IsNullOrEmpty(options.Password))
            {
                problems.Add("Smtp:Password is not configured.");
            }

            return problems.Count == 0
                ? ValidateOptionsResult.Success
                : ValidateOptionsResult.Fail($"{string.Join(' ', problems)} {FixAdvice}");
        }
    }
}
