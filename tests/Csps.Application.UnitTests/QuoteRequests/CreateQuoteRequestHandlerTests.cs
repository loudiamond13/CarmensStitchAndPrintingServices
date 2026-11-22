using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-01, D-24, SEC-08: the handler checks the form, looks a chosen line up among the shown lines and saves once.</summary>
public sealed class CreateQuoteRequestHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);
    private static readonly Guid LineId = Guid.Parse("3a48a1d6-c812-4481-a6be-d7d7412484a0");

    [Fact]
    public async Task AFormWithANameAndANumberIsSavedOnceAtStatusNew()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var saved = harness.Added.ShouldHaveSingleItem();
        result.Value.Id.ShouldBe(saved.Id);
        saved.Status.ShouldBe(QuoteRequestStatus.New);
        saved.CreatedAtUtc.ShouldBe(Now);
        saved.CreatedById.ShouldBeNull();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        _ = harness.Store.DidNotReceive().FindShownLineAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABrokenFormListsItsFieldsAndSavesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateQuoteRequestRequest.Empty, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("quote-requests.validation");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["contactNumber", "customerName"]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AShownLineIsSavedWithItsIdAndTitle()
    {
        var harness = new Harness();
        harness.Store.FindShownLineAsync("basketball", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<QuoteProductLine?>(new QuoteProductLine(LineId, "Basketball Jerseys")));

        var result = await harness.Handler.HandleAsync(Request() with { ProductChoice = "line", ProductLineKey = " basketball ", Quantity = "10-20" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var saved = harness.Added.ShouldHaveSingleItem();
        saved.ProductChoice.ShouldBe(QuoteProductChoice.Line);
        saved.ProductLineId.ShouldBe(LineId);
        saved.ProductTitle.ShouldBe("Basketball Jerseys");
        saved.QuantityRange.ShouldBe(QuoteQuantityRange.TenToTwenty);
    }

    [Fact]
    public async Task AnUnknownOrHiddenLineIsRefusedOnTheLineKeyAndSavesNothing()
    {
        var harness = new Harness();
        harness.Store.FindShownLineAsync("volleyball", Arg.Any<CancellationToken>()).Returns(Task.FromResult<QuoteProductLine?>(null));

        var result = await harness.Handler.HandleAsync(Request() with { ProductChoice = "line", ProductLineKey = "volleyball" }, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields["productLineKey"].ShouldBe(["Choose a product from the list."]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Theory]
    [InlineData("custom")]
    [InlineData("not-sure")]
    public async Task ACustomOrNotSureChoiceIgnoresAnyLineKey(string choice)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request() with { ProductChoice = choice, ProductLineKey = "basketball" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem().ProductLineId.ShouldBeNull();
        _ = harness.Store.DidNotReceive().FindShownLineAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheDomainChecksAgainSoAFormThePassingValidatorLetsThroughIsStillRefused()
    {
        var harness = new Harness(PassingValidator());

        var result = await harness.Handler.HandleAsync(Request() with { ContactNumber = "02 8123 4567" }, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()["contactNumber"].ShouldBe(["Enter a mobile number, like 0917 123 4567."]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task DeclaredPhotosAreSavedAsEmptyPlacesWithTheHashOfTheKeyAndItsEndTime()
    {
        var harness = new Harness();
        var key = System.Buffers.Text.Base64Url.EncodeToString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

        var result = await harness.Handler.HandleAsync(Request() with { Photos = ["logo.png", "back.jpg"], UploadKey = key }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.PhotoSlots.Select(slot => (slot.Slot, slot.FileName)).ShouldBe([(0, "logo.png"), (1, "back.jpg")]);
        var saved = harness.Added.ShouldHaveSingleItem();
        saved.Photos.Count.ShouldBe(2);
        QuoteUploadKey.TryHash(key, out var hash).ShouldBeTrue();
        saved.UploadKeyHash.ShouldBe(hash);
        saved.UploadKeyExpiresAtUtc.ShouldBe(Now.AddHours(2));
    }

    [Fact]
    public async Task AFormWithNoPhotosKeepsNoKeyAndAnswersNoSlots()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request() with { UploadKey = "ignored" }, TestContext.Current.CancellationToken);

        result.Value.PhotoSlots.ShouldBeEmpty();
        var saved = harness.Added.ShouldHaveSingleItem();
        saved.UploadKeyHash.ShouldBeNull();
        saved.Photos.ShouldBeEmpty();
    }

    [Fact]
    public async Task APhotoListTheDomainRefusesSavesNothing()
    {
        var harness = new Harness(PassingValidator());

        var result = await harness.Handler.HandleAsync(
            Request() with { Photos = ["1", "2", "3", "4", "5", "6"], UploadKey = System.Buffers.Text.Base64Url.EncodeToString(new byte[32]) },
            TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["photos"]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    private static CreateQuoteRequestRequest Request() =>
        CreateQuoteRequestRequest.Empty with { CustomerName = "Juan Dela Cruz", ContactNumber = "0917 123 4567" };

    private static IValidator<CreateQuoteRequestRequest> PassingValidator()
    {
        var validator = Substitute.For<IValidator<CreateQuoteRequestRequest>>();
        validator.ValidateAsync(Arg.Any<CreateQuoteRequestRequest>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(new ValidationResult()));
        return validator;
    }

    private sealed class Harness
    {
        public Harness(IValidator<CreateQuoteRequestRequest>? validator = null)
        {
            Store = Substitute.For<IQuoteRequestStore>();
            Store.When(store => store.Add(Arg.Any<QuoteRequest>())).Do(call => Added.Add(call.Arg<QuoteRequest>()));
            Handler = new CreateQuoteRequestHandler(Store, new FixedCalendar(), Unit, validator ?? new CreateQuoteRequestRequestValidator(), new QuoteRequestSettings());
        }

        public IQuoteRequestStore Store { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public List<QuoteRequest> Added { get; } = [];

        public CreateQuoteRequestHandler Handler { get; }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(TimeZoneInfo.Utc, ZoneSource.Stored, Now));
    }
}
