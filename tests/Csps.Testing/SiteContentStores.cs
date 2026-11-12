using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Testing;

/// <summary>A business info store that answers the staff read from memory, so a signed-in request succeeds without a database.</summary>
public sealed class FixedSiteContentStore : ISiteContentStore
{
    private static readonly byte[] Version = [0, 0, 0, 0, 0, 0, 0x0B, 0xD1];

    /// <inheritdoc />
    public Task<SiteSettingsForUpdate> GetSettingsForUpdateAsync(CancellationToken cancellationToken) =>
        throw new NotSupportedException("This stub only answers reads.");

    /// <inheritdoc />
    public void ReplacePhones(IReadOnlyList<SitePhoneNumber> current, IReadOnlyList<SitePhoneNumber> replacement) =>
        throw new NotSupportedException("This stub only answers reads.");

    /// <inheritdoc />
    public Task<SiteSettingsView> GetViewAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new SiteSettingsView(
            "Sample Shop",
            "Sample tagline",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            string.Empty,
            null,
            null,
            string.Empty,
            [],
            "Asia/Manila",
            "PHP",
            "en-PH",
            Version,
            null,
            null));
}

/// <summary>A business info store whose read fails with a given message, to prove a 500 never shows it.</summary>
/// <param name="message">The failure message.</param>
public sealed class ThrowingSiteContentStore(string message) : ISiteContentStore
{
    /// <inheritdoc />
    public Task<SiteSettingsForUpdate> GetSettingsForUpdateAsync(CancellationToken cancellationToken) =>
        throw new InvalidOperationException(message);

    /// <inheritdoc />
    public void ReplacePhones(IReadOnlyList<SitePhoneNumber> current, IReadOnlyList<SitePhoneNumber> replacement) =>
        throw new InvalidOperationException(message);

    /// <inheritdoc />
    public Task<SiteSettingsView> GetViewAsync(CancellationToken cancellationToken) =>
        throw new InvalidOperationException(message);
}
