using Csps.Application.Content;
using Csps.Application.Ports;
using NSubstitute;
using NSubstitute.Core;

namespace Csps.Application.UnitTests.Content;

/// <summary>D-29: the read-site-settings use case maps the cached snapshot and never hides a reader failure.</summary>
public sealed class GetSiteSettingsHandlerTests
{
    private static readonly SiteSettingsSnapshot Snapshot = new(
        BusinessName: "Business",
        TimeZoneId: "Asia/Manila",
        CurrencyCode: "PHP",
        Locale: "en-PH",
        ContactEmail: "mail@example.test",
        ContactPhone: "0917 000 0001",
        AddressLine: "1 Test Street",
        FacebookUrl: "https://facebook.example.test/page",
        RowVersion: "AAAAAAAAB9E=");

    [Fact]
    public async Task MapsSnapshotToDto()
    {
        var reader = Reader(_ => ValueTask.FromResult(Snapshot));
        var handler = new GetSiteSettingsHandler(reader);

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var dto = result.Value;
        dto.BusinessName.ShouldBe(Snapshot.BusinessName);
        dto.TimeZoneId.ShouldBe(Snapshot.TimeZoneId);
        dto.CurrencyCode.ShouldBe(Snapshot.CurrencyCode);
        dto.Locale.ShouldBe(Snapshot.Locale);
        dto.ContactEmail.ShouldBe(Snapshot.ContactEmail);
        dto.ContactPhone.ShouldBe(Snapshot.ContactPhone);
        dto.AddressLine.ShouldBe(Snapshot.AddressLine);
        dto.FacebookUrl.ShouldBe(Snapshot.FacebookUrl);
        dto.RowVersion.ShouldBe(Snapshot.RowVersion);
    }

    [Fact]
    public async Task PassesTheCancellationTokenToTheReader()
    {
        var reader = Reader(_ => ValueTask.FromResult(Snapshot));
        var handler = new GetSiteSettingsHandler(reader);
        using var cancellation = new CancellationTokenSource();

        await handler.HandleAsync(cancellation.Token);

        await reader.Received(1).GetAsync(cancellation.Token);
    }

    [Fact]
    public async Task ReaderFailurePropagates()
    {
        var reader = Reader(_ => ValueTask.FromException<SiteSettingsSnapshot>(new InvalidOperationException("reader failed")));
        var handler = new GetSiteSettingsHandler(reader);

        var exception = await Should.ThrowAsync<InvalidOperationException>(() => handler.HandleAsync(TestContext.Current.CancellationToken));

        exception.Message.ShouldBe("reader failed");
    }

    [Fact]
    public void DtoFromRejectsNull() =>
        Should.Throw<ArgumentNullException>(() => SiteSettingsDto.From(null!));

    private static ISiteSettingsReader Reader(Func<CallInfo, ValueTask<SiteSettingsSnapshot>> result)
    {
        var reader = Substitute.For<ISiteSettingsReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetAsync(Arg.Any<CancellationToken>()).Returns(result);
#pragma warning restore CA2012
        return reader;
    }
}
