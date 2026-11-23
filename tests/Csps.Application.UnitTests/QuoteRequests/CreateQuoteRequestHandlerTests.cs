using Csps.Application.Auth;
using Csps.Application.Email;
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

        var result = await harness.Handler.HandleAsync(CreateQuoteRequestRequest.Empty with { Ticket = "ticket" }, TestContext.Current.CancellationToken);

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

    [Fact]
    public async Task ASendWithNoGoodTicketIsA400AndNothingIsJudgedOrSaved()
    {
        var harness = new Harness { TicketReading = QuoteTicketReading.Expired };

        var result = await harness.Handler.HandleAsync(Request() with { SubjectLine = "text" }, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("quote-requests.ticket-expired");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["ticket"]);
        harness.Caught.ShouldBeEmpty("an expired ticket is not a caught bot");
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Theory]
    [InlineData(3)]
    [InlineData(0)]
    [InlineData(60)]
    public async Task ATicketExpiredAnswerCarriesAReplacementIssuedAlreadyMinimumSecondsOld(int minimumSeconds)
    {
        var harness = new Harness(minimumSeconds: minimumSeconds) { TicketReading = QuoteTicketReading.Expired };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.Error.Extensions.ShouldNotBeNull()["replacementTicket"].ShouldBe("replacement-ticket");
        result.Error.Extensions["minimumSeconds"].ShouldBe(minimumSeconds);
        harness.IssuedAt.ShouldBe([Now - TimeSpan.FromSeconds(minimumSeconds)]);
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task AGoodTicketIssuesNoReplacement()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.IssuedAt.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("hello")]
    [InlineData(" x ")]
    public async Task AFilledHoneypotAnswersLikeASavedRequestAndSavesNothing(string honeypot)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            Request() with { SubjectLine = honeypot, Photos = ["a/b/logo.png", "", null!, "c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg"] },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Id.ShouldNotBe(Guid.Empty);
        result.Value.PhotoSlots.Select(slot => (slot.Slot, slot.FileName)).ShouldBe([(0, "logo.png"), (1, "Photo 2"), (2, "Photo 3"), (3, "c.jpg"), (4, "d.jpg")]);
        harness.Caught.ShouldBe(["honeypot"]);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        _ = harness.Store.DidNotReceive().FindShownLineAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheLockIsTakenBeforeTheSenderIsCountedAndTheCountIsBeforeTheInsert()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request() with { Email = "Juan@Example.com" }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Order.ShouldBe(["lock", "count", "add"]);
        harness.CountedFor.ShouldBe(("+639171234567", "Juan@Example.com", Now - TimeSpan.FromHours(24)));
    }

    [Fact]
    public async Task ALockThatIsNotHadInTimeIsTheBusyTryAgainAnswerAndNothingIsSaved()
    {
        var harness = new Harness { LockFailure = new QuoteRequestsBusyException() };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        result.Error.Kind.ShouldBe(Csps.Domain.Common.ErrorKind.Conflict);
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARaceLostOnceIsRunAgainAndSavedAndLostTwiceIsTheBusyAnswer()
    {
        var once = new Harness();
        once.Unit.FailFirstSaveWithConflict();
        var twice = new Harness();
        twice.Unit.FailEverySaveWithConflict();

        var retried = await once.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);
        var busy = await twice.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        retried.IsSuccess.ShouldBeTrue();
        once.Unit.Saves.ShouldBe(2);
        busy.IsFailure.ShouldBeTrue();
        busy.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task ASenderAtTheLimitIsRefusedWithAWaitUntilTheOldestRequestLeavesTheWindowAndNothingIsSaved()
    {
        var harness = new Harness(perSenderPerDay: 3)
        {
            Recent = new QuoteSenderRecent([Now - TimeSpan.FromHours(20), Now - TimeSpan.FromHours(10), Now - TimeSpan.FromHours(1)]),
        };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(Csps.Domain.Common.ErrorKind.TooManyRequests);
        result.Error.Code.ShouldBe("rate-limited");
        result.Error.Message.ShouldBe(QuoteRequestErrors.SenderLimitMessage);
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromHours(4));
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ASenderOverTheLimitWaitsForEnoughRequestsToLeaveTheWindow()
    {
        var harness = new Harness(perSenderPerDay: 2)
        {
            Recent = new QuoteSenderRecent([Now - TimeSpan.FromHours(23), Now - TimeSpan.FromHours(22), Now - TimeSpan.FromHours(1)]),
        };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.Error.RetryAfter.ShouldBe(TimeSpan.FromHours(2), "two must leave before the sender is under the limit of 2");
    }

    [Fact]
    public async Task ASenderOneBelowTheLimitIsSaved()
    {
        var harness = new Harness(perSenderPerDay: 3) { Recent = new QuoteSenderRecent([Now - TimeSpan.FromHours(2), Now - TimeSpan.FromHours(1)]) };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task AWhitespaceHoneypotIsNotAFill()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Request() with { SubjectLine = "   " }, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Caught.ShouldBeEmpty();
        harness.Added.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task ATicketOneTickYoungerThanTheMinimumIsCaughtAndExactlyTheMinimumIsSaved()
    {
        var young = new Harness { TicketReading = QuoteTicketReading.Valid(TimeSpan.FromSeconds(3) - TimeSpan.FromTicks(1)) };
        var exact = new Harness { TicketReading = QuoteTicketReading.Valid(TimeSpan.FromSeconds(3)) };

        var caught = await young.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);
        var saved = await exact.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        caught.IsSuccess.ShouldBeTrue();
        young.Caught.ShouldBe(["too-fast"]);
        young.Added.ShouldBeEmpty();
        young.Unit.Saves.ShouldBe(0);
        saved.IsSuccess.ShouldBeTrue();
        exact.Caught.ShouldBeEmpty();
        exact.Added.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task AZeroMinimumNeverCatchesATicketThatIsNotYetOneSecondOld()
    {
        var harness = new Harness(minimumSeconds: 0) { TicketReading = QuoteTicketReading.Valid(TimeSpan.FromTicks(-5)) };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Caught.ShouldBeEmpty("a clock that moved back is read as age zero");
        harness.Added.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task AnAlertIsQueuedAfterTheInsertAndBeforeTheSaveWithTheSummary()
    {
        var harness = new Harness { AlertsAddress = " quotes@example.com " };
        harness.Store.FindShownLineAsync("basketball", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<QuoteProductLine?>(new QuoteProductLine(LineId, "Basketball Jerseys")));
        var request = Request() with
        {
            TeamName = "Riverside Riders",
            ProductChoice = "line",
            ProductLineKey = "basketball",
            Quantity = "21-50",
            Message = "We need 30 jerseys.",
            Photos = ["a.png", "b.png", "c.png"],
            UploadKey = System.Buffers.Text.Base64Url.EncodeToString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)),
        };

        var result = await harness.Handler.HandleAsync(request, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var alert = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<QuoteAlertEmail>();
        alert.To.ShouldBe("quotes@example.com");
        alert.RequestId.ShouldBe(result.Value.Id);
        alert.CustomerName.ShouldBe("Juan Dela Cruz");
        alert.TeamName.ShouldBe("Riverside Riders");
        alert.PhoneDisplay.ShouldBe("0917 123 4567");
        alert.ProductTitle.ShouldBe("Basketball Jerseys");
        alert.QuantityLabel.ShouldBe("21-50 pcs");
        alert.PhotoCount.ShouldBe(3);
        alert.MessageExcerpt.ShouldBe("We need 30 jerseys.");
        harness.Order.ShouldBe(["lock", "count", "add", "enqueue"]);
        harness.Outbox.SavesAtEnqueue.ShouldBe(0, "the alert is queued before the one save, so it commits with the request");
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task NoAddressQueuesNoAlertAndTheRequestIsStillSaved()
    {
        var harness = new Harness { AlertsAddress = "   " };

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem();
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAddressThatCannotReceiveMailStillSavesTheRequest()
    {
        var harness = new Harness { AlertsAddress = "quotes@example.com" };
        harness.Outbox.FailWith = new ArgumentException("The recipient cannot receive mail.");

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Added.ShouldHaveSingleItem();
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ACaughtBotAndARefusedSenderQueueNoAlert()
    {
        var caught = new Harness { AlertsAddress = "quotes@example.com" };
        var refused = new Harness(perSenderPerDay: 1) { AlertsAddress = "quotes@example.com" };
        refused.Recent = new QuoteSenderRecent([Now.AddHours(-1)]);

        await caught.Handler.HandleAsync(Request() with { SubjectLine = "hello-bot-text" }, TestContext.Current.CancellationToken);
        var result = await refused.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        caught.Outbox.Emails.ShouldBeEmpty();
        refused.Outbox.Emails.ShouldBeEmpty();
    }

    private static CreateQuoteRequestRequest Request() =>
        CreateQuoteRequestRequest.Empty with { CustomerName = "Juan Dela Cruz", ContactNumber = "0917 123 4567", Ticket = "ticket" };

    private static IValidator<CreateQuoteRequestRequest> PassingValidator()
    {
        var validator = Substitute.For<IValidator<CreateQuoteRequestRequest>>();
        validator.ValidateAsync(Arg.Any<CreateQuoteRequestRequest>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(new ValidationResult()));
        return validator;
    }

    private sealed class Harness
    {
        public Harness(IValidator<CreateQuoteRequestRequest>? validator = null, int minimumSeconds = 3, int perSenderPerDay = 3)
        {
            Store = Substitute.For<IQuoteRequestStore>();
            Store.When(store => store.Add(Arg.Any<QuoteRequest>())).Do(call =>
            {
                Order.Add("add");
                Added.Add(call.Arg<QuoteRequest>());
            });
            Store.LockAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            {
                Order.Add("lock");
                return LockFailure is null ? Task.CompletedTask : Task.FromException(LockFailure);
            });
            Store.CountRecentFromSenderAsync(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                Order.Add("count");
                CountedFor = (call.ArgAt<string>(0), call.ArgAt<string?>(1), call.ArgAt<DateTimeOffset>(2));
                return Task.FromResult(Recent);
            });
            var tickets = Substitute.For<IQuoteFormTickets>();
            tickets.Read(Arg.Any<string?>(), Arg.Any<DateTimeOffset>()).Returns(_ => TicketReading);
            tickets.Issue(Arg.Any<DateTimeOffset>()).Returns(call =>
            {
                IssuedAt.Add(call.Arg<DateTimeOffset>());
                return "replacement-ticket";
            });
            var botLog = Substitute.For<IQuoteBotCatchLog>();
            botLog.When(log => log.Caught(Arg.Any<string>())).Do(call => Caught.Add(call.Arg<string>()));
            var siteContent = SiteContent;
            Outbox = new ProbeOutbox(this);
            Handler = new CreateQuoteRequestHandler(
                Store,
                new FixedCalendar(),
                Unit,
                validator ?? new CreateQuoteRequestRequestValidator(),
                new QuoteRequestSettings { MinimumSeconds = minimumSeconds, PerSenderPerDay = perSenderPerDay },
                tickets,
                botLog,
                siteContent,
                Outbox);
        }

        public string AlertsAddress
        {
            set => SiteContent.GetQuoteAlertsEmailAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(value));
        }

        public ISiteContentStore SiteContent { get; } = Substitute.For<ISiteContentStore>();

        public ProbeOutbox Outbox { get; }

        public QuoteSenderRecent Recent { get; set; } = new([]);

        public List<string> Order { get; } = [];

        public (string E164, string? Email, DateTimeOffset Since) CountedFor { get; private set; }

        public QuoteTicketReading TicketReading { get; set; } = QuoteTicketReading.Valid(TimeSpan.FromSeconds(10));

        public List<string> Caught { get; } = [];

        public List<DateTimeOffset> IssuedAt { get; } = [];

        public Exception? LockFailure { get; set; }

        public IQuoteRequestStore Store { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public List<QuoteRequest> Added { get; } = [];

        public CreateQuoteRequestHandler Handler { get; }
    }

    // Keeps what was queued and notes how far the request had got.
    private sealed class ProbeOutbox(Harness harness) : IEmailOutbox
    {
        public List<AuthEmail> Emails { get; } = [];

        public Exception? FailWith { get; set; }

        public int SavesAtEnqueue { get; private set; } = -1;

        public ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
        {
            if (FailWith is not null)
            {
                throw FailWith;
            }

            harness.Order.Add("enqueue");
            SavesAtEnqueue = harness.Unit.Saves;
            Emails.Add(email);
            return ValueTask.CompletedTask;
        }

        public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken) => Task.FromResult(0);

        public Task<int> ScrubRecipientAsync(string oldAddress, string replacement, DateTimeOffset now, CancellationToken cancellationToken) => Task.FromResult(0);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(TimeZoneInfo.Utc, ZoneSource.Stored, Now));
    }
}
