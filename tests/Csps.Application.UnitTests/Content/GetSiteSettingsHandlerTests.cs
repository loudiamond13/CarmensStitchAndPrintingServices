using Csps.Application.Content;
using Csps.Application.Ports;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>D-29, CONT-01: the read-site-settings use case maps everything the Business Info tab shows and never hides a store failure.</summary>
public sealed class GetSiteSettingsHandlerTests
{
    private static readonly DateTimeOffset ChangedAt = new(2026, 11, 12, 9, 30, 0, TimeSpan.Zero);

    private static readonly SiteSettingsView View = new(
        BusinessName: "Sample Shop",
        Tagline: "Sample tagline",
        AboutText: "About the sample shop.",
        TurnaroundLine: null,
        Street: "12 Sample St., Poblacion",
        TownOrCity: "Sample City",
        Province: "Sample Province",
        PostalCode: "1000",
        DirectionsUrl: "https://maps.app.goo.gl/abc123",
        MapEmbedUrl: null,
        MessengerUrl: "https://m.me/cspsdemo",
        FacebookUrl: string.Empty,
        InstagramUrl: null,
        TikTokUrl: "https://www.tiktok.com/@cspsdemo",
        ContactEmail: "shop-private@example.test",
        Phones: [new SitePhoneView("+639171234567", "Globe", IsMain: true), new SitePhoneView("+63281234567", null, IsMain: false)],
        TimeZoneId: "Asia/Manila",
        CurrencyCode: "PHP",
        Locale: "en-PH",
        RowVersion: [0, 0, 0, 0, 0, 0, 0x0B, 0xD1],
        UpdatedByName: "Paolo Reyes",
        UpdatedAtUtc: ChangedAt);

    [Fact]
    public async Task MapsTheViewToTheDtoWithEveryField()
    {
        var handler = new GetSiteSettingsHandler(Store(View));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var dto = result.Value;
        dto.BusinessName.ShouldBe("Sample Shop");
        dto.Tagline.ShouldBe("Sample tagline");
        dto.AboutText.ShouldBe("About the sample shop.");
        dto.TurnaroundLine.ShouldBeNull();
        dto.Street.ShouldBe("12 Sample St., Poblacion");
        dto.TownOrCity.ShouldBe("Sample City");
        dto.Province.ShouldBe("Sample Province");
        dto.PostalCode.ShouldBe("1000");
        dto.DirectionsUrl.ShouldBe("https://maps.app.goo.gl/abc123");
        dto.MapEmbedUrl.ShouldBeNull();
        dto.MessengerUrl.ShouldBe("https://m.me/cspsdemo");
        dto.InstagramUrl.ShouldBeNull();
        dto.TiktokUrl.ShouldBe("https://www.tiktok.com/@cspsdemo");
        dto.ContactEmail.ShouldBe("shop-private@example.test");
        dto.TimeZoneId.ShouldBe("Asia/Manila");
        dto.CurrencyCode.ShouldBe("PHP");
        dto.Locale.ShouldBe("en-PH");
        dto.Version.ShouldBe("AAAAAAAAC9E=");
        dto.UpdatedByName.ShouldBe("Paolo Reyes");
        dto.UpdatedAtUtc.ShouldBe(ChangedAt);
    }

    [Fact]
    public async Task AValueStoredAsAnEmptyStringReadsAsNotSet()
    {
        var handler = new GetSiteSettingsHandler(Store(View with { FacebookUrl = string.Empty, ContactEmail = string.Empty }));

        var dto = (await handler.HandleAsync(TestContext.Current.CancellationToken)).Value;

        dto.FacebookUrl.ShouldBeNull();
        dto.ContactEmail.ShouldBeNull();
    }

    [Fact]
    public async Task PhonesShowAsTheNumberPeopleReadWithTheMainOneKept()
    {
        var handler = new GetSiteSettingsHandler(Store(View));

        var dto = (await handler.HandleAsync(TestContext.Current.CancellationToken)).Value;

        dto.Phones.ShouldBe([new SitePhoneDto("0917 123 4567", "Globe", true), new SitePhoneDto("02 8123 4567", null, false)]);
    }

    [Fact]
    public async Task ANumberThatIsNotParsableIsShownAsStored()
    {
        var handler = new GetSiteSettingsHandler(Store(View with { Phones = [new SitePhoneView("12345", null, IsMain: true)] }));

        var dto = (await handler.HandleAsync(TestContext.Current.CancellationToken)).Value;

        dto.Phones.ShouldBe([new SitePhoneDto("12345", null, true)]);
    }

    [Fact]
    public async Task PassesTheCancellationTokenToTheStore()
    {
        var store = Store(View);
        var handler = new GetSiteSettingsHandler(store);
        using var cancellation = new CancellationTokenSource();

        await handler.HandleAsync(cancellation.Token);

        await store.Received(1).GetViewAsync(cancellation.Token);
    }

    [Fact]
    public async Task StoreFailurePropagates()
    {
        var store = Substitute.For<ISiteContentStore>();
        store.GetViewAsync(Arg.Any<CancellationToken>()).Returns<Task<SiteSettingsView>>(_ => throw new InvalidOperationException("store failed"));
        var handler = new GetSiteSettingsHandler(store);

        var exception = await Should.ThrowAsync<InvalidOperationException>(() => handler.HandleAsync(TestContext.Current.CancellationToken));

        exception.Message.ShouldBe("store failed");
    }

    [Fact]
    public void DtoFromRejectsNull() =>
        Should.Throw<ArgumentNullException>(() => SiteSettingsDto.From(null!));

    private static ISiteContentStore Store(SiteSettingsView view)
    {
        var store = Substitute.For<ISiteContentStore>();
        store.GetViewAsync(Arg.Any<CancellationToken>()).Returns(view);
        return store;
    }
}
