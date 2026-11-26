using System.Reflection;
using Csps.Application.Common;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-01, SEC-07, SEC-08, AUDIT-01, PUB-03: saving the business info runs its steps in one order and stops at the first failure: the
/// form is checked (400), the version is the stored one (409), then the values are stored. A form with no change saves nothing, writes no
/// audit entry and keeps the version. A change writes one audit entry that names the fields and never copies a long text, the email or
/// a phone number. All values are fake.
/// </summary>
public sealed class UpdateSiteSettingsHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Now.AddHours(1);
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];
    private static readonly string StoredVersionText = RowVersions.ToText(StoredVersion);
    private static readonly string StaleVersionText = RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA3]);

    private static readonly BusinessInfo Stored = new(
        "Old Shop",
        "Old tagline",
        "Old about text.",
        "Mockups in 24 hours.",
        "12 Sample St., Poblacion",
        "Sample City",
        "Sample Province",
        "1000",
        "https://maps.app.goo.gl/abc123",
        "https://www.google.com/maps/embed?pb=sample",
        "https://m.me/oldpage",
        "https://www.facebook.com/oldpage",
        "https://www.instagram.com/oldpage",
        "https://www.tiktok.com/@oldpage",
        "old-private@example.test",
        "old-alerts@example.test",
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    [Fact]
    public async Task AFormWithNoChangeSavesNothingWritesNoAuditEntryAndKeepsTheVersion()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Store.DidNotReceiveWithAnyArgs().ReplacePhones(default!, default!);
        harness.Settings.UpdatedAtUtc.ShouldBe(Now);
        harness.Settings.RowVersion.ShouldBe(StoredVersion);
    }

    [Fact]
    public async Task ANameAndTaglineChangeSavesOnceAndWritesOneAuditEntryThatNamesBothAndShowsTheNameButNotTheTagline()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored) with { BusinessName = "New Shop", Tagline = "New tagline" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.SiteSettingsChanged);
        entry.TargetType.ShouldBe("SiteSettings");
        entry.TargetId.ShouldBe("1");
        entry.Independent.ShouldBeFalse();
        entry.Detail.ShouldBe("fields=businessName,tagline;businessName=Old Shop>New Shop");
        var text = entry.Detail.ShouldNotBeNull();
        text.ShouldNotContain("New tagline");
        text.ShouldNotContain("Old tagline");
        harness.Store.DidNotReceiveWithAnyArgs().ReplacePhones(default!, default!);
        harness.Settings.BusinessName.ShouldBe("New Shop");
        harness.Settings.Tagline.ShouldBe("New tagline");
        harness.Settings.UpdatedAtUtc.ShouldBe(Later);
    }

    [Fact]
    public async Task ALinkChangeShowsTheOldAndNewValuesInTheAuditDetail()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { MessengerUrl = "https://m.me/newpage", FacebookUrl = "https://www.facebook.com/newpage" },
            TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe(
            "fields=messengerUrl,facebookUrl;messengerUrl=https://m.me/oldpage>https://m.me/newpage;facebookUrl=https://www.facebook.com/oldpage>https://www.facebook.com/newpage");
    }

    [Fact]
    public async Task AnAddedAndARemovedLinkShowAsEmptyOnTheOtherSide()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { InstagramUrl = null, TiktokUrl = "https://www.tiktok.com/@oldpage?lang=en" },
            TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe(
            "fields=instagramUrl,tiktokUrl;instagramUrl=https://www.instagram.com/oldpage>;tiktokUrl=https://www.tiktok.com/@oldpage>https://www.tiktok.com/@oldpage?lang%3Den");
    }

    [Fact]
    public async Task AnAboutTextTurnaroundAndEmailChangeNameOnlyTheFieldsNeverTheText()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { AboutText = "New about text.", TurnaroundLine = "Mockups in 48 hours.", ContactEmail = "new-private@example.test" },
            TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.ShouldBe("fields=aboutText,turnaroundLine,contactEmail");
        detail.ShouldNotContain("@");
        detail.ShouldNotContain("about text");
    }

    [Fact]
    public async Task AQuoteAlertsEmailChangeNamesOnlyTheFieldAndKeepsTheAddressOutOfTheEntry()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { QuoteAlertsEmail = "new-alerts@example.test" },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Settings.QuoteAlertsEmail.ShouldBe("new-alerts@example.test");
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=quoteAlertsEmail");
    }

    [Fact]
    public async Task ABodyWithoutAQuoteAlertsEmailClearsTheSavedOne()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(RequestFrom(Stored) with { QuoteAlertsEmail = null }, TestContext.Current.CancellationToken);

        harness.Settings.QuoteAlertsEmail.ShouldBeEmpty();
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=quoteAlertsEmail");
    }

    [Fact]
    public async Task AnAddressChangeNamesTheFieldsAndKeepsTheirValuesOutOfTheEntry()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { Street = "34 Sample Ave.", TownOrCity = "New City", Province = "New Province", PostalCode = "2000" },
            TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=street,townOrCity,province,postalCode");
    }

    [Fact]
    public async Task APhoneOnlyChangeReplacesTheRowsMovesTheSettingsRowAndAuditsPhonesWithoutTheNumbers()
    {
        var harness = new Harness(Later);
        var before = harness.CurrentPhones;
        var request = RequestFrom(Stored) with
        {
            Phones = [new PhoneEntry("0917 123 4567", "Globe", IsMain: true), new PhoneEntry("0918 765 4321", "Smart", IsMain: false)],
        };

        var result = await harness.Handler.HandleAsync(request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Store.Received(1).ReplacePhones(
            before,
            Arg.Is<IReadOnlyList<SitePhoneNumber>>(rows => rows.Count == 2 && rows[0].Number == "+639171234567" && rows[1].Number == "+639187654321"));
        harness.Settings.UpdatedAtUtc.ShouldBe(Later);
        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.ShouldBe("fields=phones");
        detail.ShouldNotContain("0917");
        detail.ShouldNotContain("+63");
    }

    [Fact]
    public async Task MovingTheMainNumberOrChangingALabelIsAPhoneChange()
    {
        var moved = new Harness(Later);
        var relabeled = new Harness(Later);

        await moved.Handler.HandleAsync(
            RequestFrom(Stored) with { Phones = [new PhoneEntry("0917 123 4567", "Globe", IsMain: false), new PhoneEntry("02 8123 4567", null, IsMain: true)] },
            TestContext.Current.CancellationToken);
        await relabeled.Handler.HandleAsync(
            RequestFrom(Stored) with { Phones = [new PhoneEntry("0917 123 4567", "Smart", IsMain: true), new PhoneEntry("02 8123 4567", null, IsMain: false)] },
            TestContext.Current.CancellationToken);

        moved.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=phones");
        relabeled.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=phones");
        moved.Store.Received(1).ReplacePhones(Arg.Any<IReadOnlyList<SitePhoneNumber>>(), Arg.Is<IReadOnlyList<SitePhoneNumber>>(rows => rows[0].Number == "+63281234567" && rows[0].IsMain));
    }

    [Fact]
    public async Task APhoneChangeAndAFieldChangeShareOneEntryThatNamesBoth()
    {
        var harness = new Harness(Later);

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { Tagline = "New tagline", Phones = [new PhoneEntry("0917 123 4567", "Globe", IsMain: true)] },
            TestContext.Current.CancellationToken);

        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("fields=tagline,phones");
    }

    [Fact]
    public async Task AStaleVersionIs409AndNothingIsLoadedChangedOrWritten()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored, StaleVersionText) with { Tagline = "New tagline" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("edit.stale");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Store.DidNotReceiveWithAnyArgs().ReplacePhones(default!, default!);
        harness.Settings.Tagline.ShouldBe("Old tagline");
    }

    [Fact]
    public async Task ASaveThatLosesARaceIs409AndIsNeverRetried()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored) with { Tagline = "New tagline" }, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(1);
    }

    [Fact]
    public async Task ABadFormIs400OnItsFieldsAndNothingIsLoaded()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored) with { Tagline = " ", Phones = [] }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("site-content.invalid-request");
        result.Error.Message.ShouldBe("Check the highlighted fields.");
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields["tagline"].ShouldBe(["Enter a tagline."]);
        fields["phones"].ShouldBe(["Add at least one phone number."]);
        await harness.Store.DidNotReceiveWithAnyArgs().GetSettingsForUpdateAsync(TestContext.Current.CancellationToken);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ABadVersionIsA400OnVersionAndAnEmptyBodyIsA400OnEveryRequiredField()
    {
        var harness = new Harness();

        var badVersion = await harness.Handler.HandleAsync(RequestFrom(Stored, "nope"), TestContext.Current.CancellationToken);
        var empty = await harness.Handler.HandleAsync(UpdateSiteSettingsRequest.Empty, TestContext.Current.CancellationToken);

        badVersion.Error.FieldErrors.ShouldNotBeNull()["version"].ShouldBe(["Reload the form and try again."]);
        empty.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldContain("businessName");
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AFailureTheValidatorDoesNotCatchComesBackFromTheDomainAndChangesNothing()
    {
        var passing = Substitute.For<IValidator<UpdateSiteSettingsRequest>>();
        passing.ValidateAsync(Arg.Any<UpdateSiteSettingsRequest>(), Arg.Any<CancellationToken>()).Returns(new ValidationResult());
        var harness = new Harness(validator: passing);

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored) with { BusinessName = new string('a', SiteSettings.BusinessNameMaxLength + 1) }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(SiteSettings.InvalidCode);
        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("businessName");
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Settings.BusinessName.ShouldBe("Old Shop");
    }

    [Fact]
    public async Task TheAnswerIsTheStoredSettingsReadAfterTheSave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestFrom(Stored) with { Tagline = "New tagline" }, TestContext.Current.CancellationToken);

        result.Value.Tagline.ShouldBe("Stored tagline");
        result.Value.Version.ShouldBe(RowVersions.ToText([0, 0, 0, 0, 0, 0, 0x1F, 0xA5]));
        await harness.Store.Received(1).GetViewAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheAuditDetailNeverGrowsPastTheLimitAndStillNamesEveryField()
    {
        var longFacebook = "https://www.facebook.com/" + new string('b', 270);
        var longInstagram = "https://www.instagram.com/" + new string('c', 270);
        var harness = new Harness(info: Stored with { BusinessName = new string('a', 100), FacebookUrl = "https://www.facebook.com/" + new string('x', 270) });

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { BusinessName = new string('n', 100), FacebookUrl = longFacebook, InstagramUrl = longInstagram },
            TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        detail.ShouldStartWith("fields=businessName,facebookUrl,instagramUrl;");
        detail.ShouldContain($"businessName={new string('a', 100)}>{new string('n', 100)}");
        detail.ShouldNotContain("bbbb");
        detail.ShouldNotContain("cccc");
    }

    [Fact]
    public async Task APairThatDoesNotFitIsSkippedWhileASmallerOneAfterItStillShows()
    {
        var harness = new Harness(info: Stored with { MapEmbedUrl = "https://www.google.com/maps/embed?pb=" + new string('x', 380), MessengerUrl = "https://m.me/oldpage" });

        await harness.Handler.HandleAsync(
            RequestFrom(Stored) with { MapEmbedUrl = "https://www.google.com/maps/embed?pb=" + new string('y', 380), MessengerUrl = "https://m.me/newpage" },
            TestContext.Current.CancellationToken);

        var detail = harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldNotBeNull();
        detail.ShouldBe("fields=mapEmbedUrl,messengerUrl;messengerUrl=https://m.me/oldpage>https://m.me/newpage");
    }

    [Fact]
    public async Task ANullFormIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    private static UpdateSiteSettingsRequest RequestFrom(BusinessInfo info, string? version = null) => new(
        version ?? StoredVersionText,
        info.BusinessName,
        info.Tagline,
        info.AboutText,
        info.TurnaroundLine,
        info.Street,
        info.TownOrCity,
        info.Province,
        info.PostalCode,
        info.DirectionsUrl,
        info.MapEmbedUrl,
        info.MessengerUrl,
        info.FacebookUrl,
        info.InstagramUrl,
        info.TikTokUrl,
        info.ContactEmail,
        info.QuoteAlertsEmail,
        [.. info.Phones.Select(static phone => new PhoneEntry(phone.Number, phone.Label, phone.IsMain))]);

    private sealed class Harness
    {
        public Harness(DateTimeOffset? now = null, IValidator<UpdateSiteSettingsRequest>? validator = null, BusinessInfo? info = null)
        {
            Settings = SiteSettings.CreateDefault(Now);
            var changes = Settings.UpdateBusinessInfo(info ?? Stored, Now).Value;
            typeof(SiteSettings).GetProperty(nameof(SiteSettings.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Settings, StoredVersion);
            CurrentPhones = changes.Phones;

            Store = Substitute.For<ISiteContentStore>();
            Store.GetSettingsForUpdateAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(new SiteSettingsForUpdate(Settings, CurrentPhones)));
            Store.GetViewAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(StoredView()));

            Handler = new UpdateSiteSettingsHandler(
                Store,
                Audit,
                Unit,
                validator ?? new UpdateSiteSettingsRequestValidator(),
                new FakeTimeProvider(now ?? Later),
                Substitute.For<IImageDelivery>());
        }

        public SiteSettings Settings { get; }

        public IReadOnlyList<SitePhoneNumber> CurrentPhones { get; }

        public ISiteContentStore Store { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public UpdateSiteSettingsHandler Handler { get; }

        private static SiteSettingsView StoredView() => new(
            "Stored shop",
            "Stored tagline",
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
            string.Empty,
            [new SitePhoneView("+639171234567", null, IsMain: true)],
            "Asia/Manila",
            "PHP",
            "en-PH",
            [0, 0, 0, 0, 0, 0, 0x1F, 0xA5],
            null,
            null);
    }
}
