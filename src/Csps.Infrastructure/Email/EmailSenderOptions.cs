using MimeKit;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Email;

/// <summary>
/// Who auth email comes from (<c>Email</c> section): the business sender, without a Reply-To (D-26). These are not
/// secrets, so appsettings.json holds them.
/// </summary>
public sealed class EmailSenderOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Email";

    /// <summary>Gets or sets the From address, for example <c>no-reply@cspstailoring.com</c>.</summary>
    public string FromAddress { get; set; } = string.Empty;

    /// <summary>Gets or sets the From display name.</summary>
    public string FromName { get; set; } = string.Empty;

    internal sealed class Validator : IValidateOptions<EmailSenderOptions>
    {
        public ValidateOptionsResult Validate(string? name, EmailSenderOptions options)
        {
            ArgumentNullException.ThrowIfNull(options);

            var problems = new List<string>();
            if (!MailboxAddress.TryParse(options.FromAddress, out var address) || !address.Address.Contains('@', StringComparison.Ordinal))
            {
                problems.Add("Email:FromAddress must be an email address.");
            }

            if (string.IsNullOrWhiteSpace(options.FromName))
            {
                problems.Add("Email:FromName is not configured.");
            }

            return problems.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(string.Join(' ', problems));
        }
    }
}
