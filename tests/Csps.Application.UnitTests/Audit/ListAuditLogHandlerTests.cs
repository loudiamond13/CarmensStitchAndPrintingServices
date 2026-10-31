using Csps.Application.Audit;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Audit;

/// <summary>AUDIT-02, D-26 to D-28, D-40, USER-06: the audit query is checked, the default range is 7 business days, and done-by follows one rule.</summary>
public sealed class ListAuditLogHandlerTests
{
    // 2026-10-19 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day. The kept window starts on 2026-02-19.
    private static readonly DateTimeOffset Now = new(2026, 10, 18, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly ActorRef Ana = new(Guid.NewGuid(), "Ana Abad", false);
    private static readonly ActorRef Bea = new(Guid.NewGuid(), "Bea Bautista", true);

    [Fact]
    public async Task WithNoDatesTheRangeIsTodayAndTheSixBusinessDaysBeforeIt()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        // Business today is Oct 19, so the range starts at 00:00 on Oct 13 and ends at 00:00 on Oct 20 (Manila time).
        await harness.Reader.Received(1).ListAsync(
            new AuditLogQuery(Utc(2026, 10, 12, 16), Utc(2026, 10, 19, 16), null, null, null, 1, 20), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABlankFilterIsTheSameAsNoFilter()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(" ", "", " ", "", "  "), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListAsync(
            new AuditLogQuery(Utc(2026, 10, 12, 16), Utc(2026, 10, 19, 16), null, null, null, 1, 20), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ThePageAndTheCountsAreEchoedBack()
    {
        var harness = new Harness(new AuditLogPage([], 41));

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(Page: 3, PageSize: 50), TestContext.Current.CancellationToken);

        result.Value.Items.ShouldBeEmpty();
        (result.Value.Total, result.Value.Page, result.Value.PageSize).ShouldBe((41, 3, 50));
        await harness.Reader.Received(1).ListAsync(Arg.Is<AuditLogQuery>(query => query.Page == 3 && query.PageSize == 50), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TwoDatesBoundTheRangeAtTheStartOfTheFirstDayAndTheStartOfTheDayAfterTheLast()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListAuditLogRequest("2026-10-05", "2026-10-07"), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 10, 4, 16) && query.EndUtcExclusive == Utc(2026, 10, 7, 16)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OneDayIsTheWholeOfThatBusinessDay()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListAuditLogRequest("2026-10-19", "2026-10-19"), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 10, 18, 16) && query.EndUtcExclusive == Utc(2026, 10, 19, 16)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnlyAStartMeansUpToTodayAndOnlyAnEndMeansFromTheStartOfTheKeptWindow()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListAuditLogRequest(From: "2026-10-10"), TestContext.Current.CancellationToken);
        await harness.Handler.HandleAsync(new ListAuditLogRequest(To: "2026-03-01"), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 10, 9, 16) && query.EndUtcExclusive == Utc(2026, 10, 19, 16)), Arg.Any<CancellationToken>());
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 2, 18, 16) && query.EndUtcExclusive == Utc(2026, 3, 1, 16)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheKeptWindowStartsEightMonthsBeforeTodayAndEndsToday()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest("2026-02-19", "2026-10-19"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 2, 18, 16) && query.EndUtcExclusive == Utc(2026, 10, 19, 16)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IfTheDayTurnsBetweenTheCheckAndTheReadAStartCannotLandAfterTheEnd()
    {
        // At the check the window starts on Feb 19; a moment later the day turns and it starts on Feb 20.
        var later = new BusinessClock(Manila, ZoneSource.Stored, Now.AddDays(1));
        var harness = new Harness(calendar: new SequenceCalendar(new BusinessClock(Manila, ZoneSource.Stored, Now), later));

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(To: "2026-02-19"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.StartUtc == Utc(2026, 2, 18, 16) && query.EndUtcExclusive == Utc(2026, 2, 19, 16)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheFiltersAreParsedAndPassedOn()
    {
        var harness = new Harness();
        var actor = Guid.NewGuid();
        var target = Guid.NewGuid();

        await harness.Handler.HandleAsync(
            new ListAuditLogRequest(Actor: actor.ToString("D"), Action: "user.locked", Target: target.ToString("D")), TestContext.Current.CancellationToken);
        await harness.Handler.HandleAsync(new ListAuditLogRequest(Actor: "system"), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.Actor == new AuditActorFilter(actor) && query.Action == "user.locked" && query.Target == target), Arg.Any<CancellationToken>());
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<AuditLogQuery>(query => query.Actor == new AuditActorFilter(null) && query.Action == null && query.Target == null), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("2026-02-30", null, "from", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData("2026-2-3", null, "from", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData("2026-10-19T00:00:00", null, "from", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData("10/19/2026", null, "from", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData(null, "tomorrow", "to", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData(null, "2026-13-01", "to", ListAuditLogRequestValidator.DateInvalid)]
    [InlineData("2026-02-18", null, "from", "Choose a date from Feb 19, 2026 to today.")]
    [InlineData(null, "2026-02-18", "to", "Choose a date from Feb 19, 2026 to today.")]
    [InlineData("2026-10-20", null, "from", "Choose a date from Feb 19, 2026 to today.")]
    [InlineData(null, "2026-10-20", "to", "Choose a date from Feb 19, 2026 to today.")]
    [InlineData("2026-10-10", "2026-10-09", "from", ListAuditLogRequestValidator.RangeOrderInvalid)]
    public async Task ABadDateOrRangeIsA400WithThePlainMessageAndTheLogIsNeverRead(string? from, string? to, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(from, to), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ListAsync(null!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task WhenBothDatesAreOutsideTheWindowOnlyThatMessageIsGivenNotTheOrderMessage()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest("2026-01-02", "2026-01-01"), TestContext.Current.CancellationToken);

        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields["from"].ShouldBe(["Choose a date from Feb 19, 2026 to today."]);
        fields["to"].ShouldBe(["Choose a date from Feb 19, 2026 to today."]);
    }

    [Fact]
    public async Task ABadStartDateWithAGoodEndDateReportsOnlyTheStart()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest("2026-02-30", "2026-10-01"), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["from"]);
    }

    [Theory]
    [InlineData("2026-10-19", "2026-10-19")]
    [InlineData("2026-02-19", "2026-02-19")]
    public async Task TheEdgesOfTheKeptWindowAreAccepted(string from, string to)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(from, to), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData("not-a-guid", null, null, "actor", ListAuditLogRequestValidator.PersonInvalid)]
    [InlineData("SYSTEM", null, null, "actor", ListAuditLogRequestValidator.PersonInvalid)]
    [InlineData("12345678123412341234123456789012", null, null, "actor", ListAuditLogRequestValidator.PersonInvalid)]
    [InlineData(null, "user.exploded", null, "action", ListAuditLogRequestValidator.ActionInvalid)]
    [InlineData(null, "USER.LOCKED", null, "action", ListAuditLogRequestValidator.ActionInvalid)]
    [InlineData(null, null, "system", "target", ListAuditLogRequestValidator.PersonInvalid)]
    [InlineData(null, null, "12345", "target", ListAuditLogRequestValidator.PersonInvalid)]
    public async Task ABadActorActionOrTargetIsA400NamingTheField(string? actor, string? action, string? target, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(Actor: actor, Action: action, Target: target), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ListAsync(null!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task EveryCodeInTheCatalogIsAValidAction()
    {
        var harness = new Harness();

        foreach (var action in AuditActions.All)
        {
            (await harness.Handler.HandleAsync(new ListAuditLogRequest(Action: action), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue(action);
        }
    }

    [Theory]
    [InlineData(AuditActions.CompanyExpenseAdded)]
    [InlineData(AuditActions.CompanyExpenseChanged)]
    [InlineData(AuditActions.CompanyExpensePayerChanged)]
    [InlineData(AuditActions.CompanyExpenseDeleted)]
    [InlineData(AuditActions.CompanyExpenseRestored)]
    [InlineData(AuditActions.CompanyExpensePermanentlyDeleted)]
    [InlineData(AuditActions.ExpenseCategoryAdded)]
    [InlineData(AuditActions.ExpenseCategoryRenamed)]
    [InlineData(AuditActions.ExpenseCategoryRecolored)]
    [InlineData(AuditActions.ExpenseCategoryRetired)]
    [InlineData(AuditActions.ExpenseCategoryReactivated)]
    [InlineData(AuditActions.ExpenseCategoryDeleted)]
    public async Task EveryPhaseSixCodeIsAcceptedByTheActionFilterAndPassedOn(string action)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(Action: action), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue(action);
        await harness.Reader.Received(1).ListAsync(Arg.Is<AuditLogQuery>(query => query.Action == action), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(-3, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(100_001, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(1, 0, "pageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "pageSize", "Use a page size from 1 to 100.")]
    public async Task ABadPageOrSizeIsA400NamingTheFieldAndTheLogIsNeverRead(int page, int pageSize, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(Page: page, PageSize: pageSize), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ListAsync(null!, TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public async Task TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(Page: page, PageSize: pageSize), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task EveryBadFieldIsReportedTogether()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            new ListAuditLogRequest("2026-02-30", "x", "x", "x", "x", 0, 0), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["action", "actor", "from", "page", "pageSize", "target", "to"]);
    }

    [Fact]
    public async Task ANullRequestIsRefusedBeforeAnythingIsRead()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public void TheValidatorNeedsACalendar()
    {
        Should.Throw<ArgumentNullException>(() => new ListAuditLogRequestValidator(null!));
    }

    [Fact]
    public async Task TheSignedInActorDidItEvenForASelfServiceCode()
    {
        var entry = Entry(AuditActions.PasswordChanged, actor: Ana, targetType: "User", target: Bea);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
        item.DoneTo.ShouldBe(Bea);
    }

    [Theory]
    [InlineData(AuditActions.SignedIn, "UserSession")]
    [InlineData(AuditActions.TwoFactorVerified, "User")]
    [InlineData(AuditActions.PasswordResetCompleted, "User")]
    [InlineData(AuditActions.InviteAccepted, "User")]
    [InlineData(AuditActions.ProfileEmailChanged, "User")]
    public async Task ASelfServiceEntryWithNoActorWasDoneByThePersonItIsAbout(string action, string targetType)
    {
        var entry = Entry(action, targetType: targetType, target: Ana);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
        item.DoneTo.ShouldBe(Ana);
    }

    [Fact]
    public async Task AFailedSignInWithNoAccountIsAnUnknownAccount()
    {
        var entry = Entry(AuditActions.SignInFailed, detail: "unknown-account");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.UnknownAccount, null));
        item.DoneTo.ShouldBeNull();
        item.Detail.ShouldBe("unknown-account");
    }

    [Fact]
    public async Task AFailedSignInForAKnownAccountWasDoneByThatPerson()
    {
        var entry = Entry(AuditActions.SignInFailed, targetType: "User", target: Ana, detail: "bad-password");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
    }

    [Theory]
    [InlineData(AuditActions.PasswordResetLinkInvalid, null)]
    [InlineData(AuditActions.PasswordResetRequested, null)]
    [InlineData(AuditActions.UserInvited, "User")]
    [InlineData(AuditActions.BootstrapManagerCreated, "User")]
    [InlineData(AuditActions.UserDeactivated, "User")]
    public async Task AnythingElseWithNoActorWasTheSystem(string action, string? targetType)
    {
        var entry = Entry(action, targetType: targetType, target: targetType is null ? null : Bea, detail: "bootstrap");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.System, null));
    }

    [Fact]
    public async Task AFailedSignInWhoseAccountCannotBeFoundIsTheSystemNotAnUnknownAccount()
    {
        var entry = Entry(AuditActions.SignInFailed, targetType: "User", target: null, detail: "bad-password");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.Kind.ShouldBe(DoneByKinds.System);
    }

    [Theory]
    [InlineData("203.0.113.0", "203.0.113.0/24")]
    [InlineData("2001:db8:abcd::", "2001:db8:abcd::/48")]
    [InlineData(null, null)]
    public async Task TheStoredNetworkIsShownWithItsLength(string? stored, string? shown)
    {
        var entry = Entry(AuditActions.UserActivated, actor: Ana, ip: stored);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.IpPrefix.ShouldBe(shown);
    }

    [Fact]
    public async Task EveryStoredFieldPassesThroughAndNothingIsAdded()
    {
        var entry = Entry(AuditActions.UserRoleChanged, actor: Ana, targetType: "User", target: Bea, detail: "role=admin>manager", ip: "198.51.100.0", device: "Chrome");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.ShouldBe(new AuditLogItem(
            entry.Id, entry.OccurredAt, new DoneBy(DoneByKinds.User, Ana), AuditActions.UserRoleChanged, Bea, "role=admin>manager", "198.51.100.0/24", "Chrome", entry.Reference, entry.Changes, null, null, null));
    }

    [Fact]
    public async Task TheOrderSnapshotAndTheOrderNumberOfAnOrderEntryPassThroughUnchanged()
    {
        var orderSnapshot = new AuditOrderSnapshot("ORD-2026-0148", "cancelled", 21327.50m, 12000.00m, 9327.50m);
        var entry = Entry(AuditActions.OrderDeleted, actor: Bea, targetType: "Order") with { OrderSnapshot = orderSnapshot, OrderNumber = "ORD-2026-0148" };
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.OrderSnapshot.ShouldBe(orderSnapshot);
        item.OrderNumber.ShouldBe("ORD-2026-0148");
    }

    [Fact]
    public async Task TheChangeLinesAndTheSnapshotOfAnExpenseEntryPassThroughUnchanged()
    {
        AuditChangeLine[] lines = [new("amount", "1200.00", "1250.00", null, null)];
        var snapshot = new AuditExpenseSnapshot(new DateOnly(2026, 10, 5), "Supplies", 1200m, Ana);
        var entry = Entry(AuditActions.CompanyExpenseAdded, actor: Bea, targetType: "CompanyExpense", target: Ana) with { Changes = lines, Snapshot = snapshot };
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.Changes.ShouldBe(lines);
        item.Snapshot.ShouldBe(snapshot);
        item.DoneTo.ShouldBe(Ana);
    }

    [Fact]
    public async Task ThePeopleHandlerPassesTheReadersListThroughInItsOrder()
    {
        IReadOnlyList<AuditPerson> people = [new(Ana.Id, Ana.Name, false), new(Bea.Id, Bea.Name, true)];
        var reader = Substitute.For<IAuditLogReader>();
        reader.ListPeopleAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(people));

        var result = await new ListAuditPeopleHandler(reader).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(people);
    }

    private static DateTimeOffset Utc(int year, int month, int day, int hour) => new(year, month, day, hour, 0, 0, TimeSpan.Zero);

    private static AuditLogEntryView Entry(
        string action,
        ActorRef? actor = null,
        string? targetType = null,
        ActorRef? target = null,
        string? detail = null,
        string? ip = null,
        string? device = null) =>
        new(7, Now.AddMinutes(-3), actor, action, targetType, target, detail, ip, device, new string('a', AuditEntry.CorrelationIdLength), [], null);

    private sealed class Harness
    {
        public Harness(AuditLogPage? page = null, IBusinessCalendar? calendar = null)
        {
            Reader = Substitute.For<IAuditLogReader>();
            Reader.ListAsync(Arg.Any<AuditLogQuery>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(page ?? new AuditLogPage([], 0)));
            var clock = calendar ?? new SequenceCalendar(new BusinessClock(Manila, ZoneSource.Stored, Now));
            Handler = new ListAuditLogHandler(Reader, clock, new ListAuditLogRequestValidator(clock));
        }

        public IAuditLogReader Reader { get; }

        public ListAuditLogHandler Handler { get; }
    }

    // Returns the clocks in order, then the last one for every later read.
    private sealed class SequenceCalendar(params BusinessClock[] clocks) : IBusinessCalendar
    {
        private int _reads;

        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(clocks[Math.Min(_reads++, clocks.Length - 1)]);
    }
}
