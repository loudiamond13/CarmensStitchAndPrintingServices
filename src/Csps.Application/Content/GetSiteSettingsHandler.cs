using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>Use case: read the site settings (D-29). One handler per use case, no mediator (PRD section 3.3).</summary>
/// <param name="reader">The cached settings reader.</param>
public sealed class GetSiteSettingsHandler(ISiteSettingsReader reader)
{
    private readonly ISiteSettingsReader _reader = reader;

    /// <summary>Returns the current site settings.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The settings.</returns>
    public Task<Result<SiteSettingsDto>> HandleAsync(CancellationToken cancellationToken)
    {
        // RED stub (01-08 Task 1): replaced by the real use case in the GREEN commit.
        _ = _reader;
        return Task.FromResult(Result.Success(SiteSettingsDto.From(null!)));
    }
}
