using Csps.Application.Auth;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-01, D-23, D-26: the query is checked before the port is called, the default window comes from the business clock, and each row says whether the caller may edit it.</summary>
public sealed class ListCompanyExpensesHandlerTests
{
    // 2026-10-25 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid OtherId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Reader.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task WithNeitherDateTheWindowIsThirtyDaysEachSideOfTheBusinessToday()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        (result.Value.From, result.Value.To, result.Value.Today).ShouldBe((new DateOnly(2026, 9, 25), new DateOnly(2026, 11, 24), new DateOnly(2026, 10, 25)));
        await harness.Reader.Received(1).ListAsync(
            new CompanyExpenseListQuery(new DateOnly(2026, 9, 25), new DateOnly(2026, 11, 24), null, null, 1, 20), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GivenDatesArePassedThroughAndEchoedWithTheBusinessToday()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(From: " 2026-01-02 ", To: "2026-01-31"), TestContext.Current.CancellationToken);

        (result.Value.From, result.Value.To, result.Value.Today).ShouldBe((new DateOnly(2026, 1, 2), new DateOnly(2026, 1, 31), new DateOnly(2026, 10, 25)));
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<CompanyExpenseListQuery>(query => query.From == new DateOnly(2026, 1, 2) && query.To == new DateOnly(2026, 1, 31)), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("thread", "thread")]
    [InlineData("  ana cruz  ", "ana cruz")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public async Task TheSearchIsTrimmedAndBlankMeansNoSearch(string? typed, string? sent)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(Q: typed), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(Arg.Is<CompanyExpenseListQuery>(query => query.Search == sent), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("447ad32e-1433-4b70-8786-72e3dc3f9937", true)]
    [InlineData(" 447AD32E-1433-4B70-8786-72E3DC3F9937 ", true)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public async Task TheCategoryBecomesAnIdOrNone(string? typed, bool expectId)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(Category: typed), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListAsync(
            Arg.Is<CompanyExpenseListQuery>(query => query.CategoryId == (expectId ? CategoryId : null)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ThePageSizeAndTheFiguresOfThePortAreEchoedBack()
    {
        var harness = new Harness(page: new CompanyExpenseListPage([], 41, 1234.50m));

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(Page: 3, PageSize: 10), TestContext.Current.CancellationToken);

        (result.Value.Total, result.Value.PeriodTotal, result.Value.Page, result.Value.PageSize).ShouldBe((41, 1234.50m, 3, 10));
        result.Value.Items.ShouldBeEmpty();
        await harness.Reader.Received(1).ListAsync(
            Arg.Is<CompanyExpenseListQuery>(query => query.Page == 3 && query.PageSize == 10), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABadQueryIsA400NamingEveryFieldAndThePortIsNeverAsked()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            new ListCompanyExpensesRequest(new string('a', 101), "nope", "2026-11-01", "2026-10-31", 0, 101), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(ExpenseErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["category", "from", "page", "pageSize", "q"]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ListAsync(null!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AManagerMayEditEveryRow()
    {
        var harness = With(Roles.Manager, Row(createdBy: OtherId, paidBy: OtherId), Row(createdBy: null, paidBy: OtherId));

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(), TestContext.Current.CancellationToken);

        result.Value.Items.Select(item => item.CanEdit).ShouldBe([true, true]);
    }

    [Fact]
    public async Task AnAdminMayEditOnlyWhatTheyRecordedOrPay()
    {
        var harness = With(
            Roles.Admin,
            Row(createdBy: CallerId, paidBy: OtherId),
            Row(createdBy: OtherId, paidBy: CallerId),
            Row(createdBy: OtherId, paidBy: OtherId),
            Row(createdBy: null, paidBy: OtherId),
            Row(createdBy: null, paidBy: CallerId));

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(), TestContext.Current.CancellationToken);

        result.Value.Items.Select(item => item.CanEdit).ShouldBe([true, true, false, false, true]);
    }

    [Fact]
    public async Task TheItemsKeepTheOrderAndTheFieldsOfThePortWithoutNotes()
    {
        var row = Row(createdBy: CallerId, paidBy: OtherId);
        var harness = With(Roles.Admin, row);

        var result = await harness.Handler.HandleAsync(new ListCompanyExpensesRequest(), TestContext.Current.CancellationToken);

        var item = result.Value.Items.ShouldHaveSingleItem();
        (item.Id, item.Date, item.Category, item.Description, item.Amount, item.PaidBy, item.RecordedBy)
            .ShouldBe((row.Id, row.Date, row.Category, row.Description, row.Amount, row.PaidBy, row.RecordedBy));
        typeof(CompanyExpenseListItem).GetProperty("Notes").ShouldBeNull();
    }

    [Fact]
    public async Task ANullRequestIsRefusedBeforeAnythingIsRead()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    private static Harness With(string callerRole, params CompanyExpenseListRow[] rows) =>
        new(callerRole, page: new CompanyExpenseListPage(rows, rows.Length, 0m));

    private static CompanyExpenseListRow Row(Guid? createdBy, Guid paidBy) =>
        new(
            Guid.NewGuid(),
            new DateOnly(2026, 10, 20),
            new ExpenseCategoryRef(CategoryId, "Supplies", "warning", false),
            "Thread",
            640.00m,
            new ActorRef(paidBy, "Mina Mercado", false),
            createdBy is { } id ? new ActorRef(id, "Paolo Reyes", false) : null,
            createdBy,
            paidBy);

    private sealed class Harness
    {
        public Harness(string callerRole = Roles.Admin, bool noCaller = false, CompanyExpenseListPage? page = null)
        {
            Reader = Substitute.For<ICompanyExpenseReader>();
            Reader.ListAsync(Arg.Any<CompanyExpenseListQuery>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(page ?? new CompanyExpenseListPage([], 0, 0m)));
            var staff = Substitute.For<IStaffDirectory>();
            staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(CallerId, "Paolo Reyes", callerRole, true, false, false, true)));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ListCompanyExpensesHandler(Reader, staff, new FixedCalendar(), request, new ListCompanyExpensesRequestValidator());
        }

        public ICompanyExpenseReader Reader { get; }

        public ListCompanyExpensesHandler Handler { get; }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
