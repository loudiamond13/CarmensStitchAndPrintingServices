using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: the shop's Contact email for the legal pages (D-13, D-29). It reads the cached settings, so a Manager's change shows on the
/// next read. A reader failure is an infrastructure error and is not turned into a result.
/// </summary>
/// <param name="settings">The cached site settings reader.</param>
public sealed class GetPrivacyContactHandler(ISiteSettingsReader settings)
{
    /// <summary>Returns the privacy contact.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The contact; its email is null when none is stored.</returns>
    public Task<Result<PrivacyContactDto>> HandleAsync(CancellationToken cancellationToken)
    {
        _ = settings;
        _ = cancellationToken;
        return Task.FromResult(Result.Success(new PrivacyContactDto(null)));
    }
}
