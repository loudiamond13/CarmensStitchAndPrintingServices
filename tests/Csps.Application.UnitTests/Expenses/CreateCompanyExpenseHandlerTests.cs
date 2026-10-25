using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>
/// CEXP-02, D-11, D-17, D-32: the handler checks the form, the category and the payer together and lists every failed field in one 400,
/// adds the expense once inside one transaction, and answers with the detail including the caller's edit right.
/// </summary>
public sealed class CreateCompanyExpenseHandlerTests
{
    // 2026-10-25 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Expenses.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARetiredCategoryIsRefusedOnTheCategoryField()
    {
        var harness = new Harness();
        harness.Categories.GetStateAsync(CategoryId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<ExpenseCategoryState?>(new ExpenseCategoryState(CategoryId, "Supplies", Retired: true)));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(new Dictionary<string, string[]> { ["categoryId"] = ["This category was retired. Choose another one."] });
        harness.Expenses.DidNotReceiveWithAnyArgs().Add(default!);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnUnknownCategoryIsTheSameAsAMissingOne()
    {
        var harness = new Harness();
        harness.Categories.GetStateAsync(CategoryId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ExpenseCategoryState?>(null));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(new Dictionary<string, string[]> { ["categoryId"] = ["Choose a category."] });
    }

    [Fact]
    public async Task AnUnknownPayerIsRefusedOnThePayerField()
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(null));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(new Dictionary<string, string[]> { ["paidByUserId"] = [ExpenseRules.PaidByInactive] });
    }

    [Theory]
    [InlineData(false, false, false, true, Roles.Admin)]
    [InlineData(true, true, false, true, Roles.Admin)]
    [InlineData(true, false, true, true, Roles.Manager)]
    [InlineData(true, false, false, false, Roles.Admin)]
    [InlineData(true, false, false, true, null)]
    public async Task APayerWhoCannotPayIsRefused(bool active, bool locked, bool deleted, bool hasPassword, string? role)
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<StaffState?>(new StaffState(PayerId, "Mina Mercado", role, active, locked, deleted, hasPassword)));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(new Dictionary<string, string[]> { ["paidByUserId"] = [ExpenseRules.PaidByInactive] });
        harness.Expenses.DidNotReceiveWithAnyArgs().Add(default!);
    }

    [Fact]
    public async Task AStaticErrorAndAPayerErrorComeBackTogetherInOneBadRequest()
    {
        var harness = new Harness();
        harness.Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(null));

        var result = await harness.Handler.HandleAsync(Valid() with { Amount = 0m, Description = " " }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("company-expenses.invalid-request");
        result.Error.Message.ShouldBe("Check the highlighted fields.");
        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "description", "paidByUserId"]);
    }

    [Fact]
    public async Task APayerOrCategoryThatIsMissingFromTheFormIsNotLookedUp()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateCompanyExpenseRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["amount", "categoryId", "date", "description", "paidByUserId"]);
        await harness.Categories.DidNotReceiveWithAnyArgs().GetStateAsync(default, TestContext.Current.CancellationToken);
        harness.Staff.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ASuccessAddsTheTrimmedExpenseOnceAndSavesOnceInOneTransaction()
    {
        var harness = new Harness();
        CompanyExpense? added = null;
        harness.Expenses.When(store => store.Add(Arg.Any<CompanyExpense>())).Do(call => added = call.Arg<CompanyExpense>());

        var result = await harness.Handler.HandleAsync(
            Valid() with { Description = "  Thread and needles  ", Notes = "  cash  " },
            TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Expenses.Received(1).Add(Arg.Any<CompanyExpense>());
        var expense = added.ShouldNotBeNull();
        expense.ExpenseDate.ShouldBe(new DateOnly(2026, 10, 25));
        expense.Description.ShouldBe("Thread and needles");
        expense.Notes.ShouldBe("cash");
        expense.Amount.ShouldBe(640.00m);
        expense.CreatedById.ShouldBeNull();
        expense.Id.Version.ShouldBe(7);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Reader.Received(1).GetDetailAsync(expense.Id, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheDateIsCheckedAgainstTheBusinessTodayNotTheUtcDay()
    {
        var harness = new Harness();

        // The UTC day is Oct 24 but the business day is Oct 25, so Nov 24 is the last allowed day and Nov 25 is not.
        (await harness.Handler.HandleAsync(Valid() with { Date = "2026-11-24" }, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        var refused = await harness.Handler.HandleAsync(Valid() with { Date = "2026-11-25" }, TestContext.Current.CancellationToken);

        Fields(refused)["date"].ShouldBe(["Choose a date up to 30 days from today, Nov 24, 2026 at the latest."]);
    }

    [Theory]
    [InlineData(Roles.Manager, true)]
    [InlineData(Roles.Admin, false)]
    public async Task TheAnswerCarriesTheCallersEditRight(string role, bool canEdit)
    {
        var harness = new Harness(callerRole: role);

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        // The stored expense was recorded by and paid for someone else, so only a Manager may edit it.
        result.Value.CanEdit.ShouldBe(canEdit);
        result.Value.Version.ShouldBe(RowVersions.ToText(Harness.Version));
        result.Value.Description.ShouldBe("Thread and needles");
    }

    [Fact]
    public async Task AnExpenseTheReaderCannotFindAfterTheSaveIsA404()
    {
        var harness = new Harness();
        harness.Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpenseDetailView?>(null));

        var result = await harness.Handler.HandleAsync(Valid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseErrors.NotFound);
    }

    private static CreateCompanyExpenseRequest Valid() => new("2026-10-25", CategoryId, "Thread and needles", 640.00m, PayerId, null);

    private static IReadOnlyDictionary<string, string[]> Fields(Result<CompanyExpenseDetailResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        return result.Error.FieldErrors.ShouldNotBeNull();
    }

    private sealed class Harness
    {
        public static readonly byte[] Version = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];

        public Harness(bool noCaller = false, string callerRole = Roles.Admin)
        {
            Expenses = Substitute.For<ICompanyExpenses>();
            Reader = Substitute.For<ICompanyExpenseReader>();
            Reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<CompanyExpenseDetailView?>(Detail()));
            Categories = Substitute.For<IExpenseCategories>();
            Categories.GetStateAsync(CategoryId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<ExpenseCategoryState?>(new ExpenseCategoryState(CategoryId, "Supplies", Retired: false)));
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(PayerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(PayerId, "Mina Mercado", Roles.Admin, true, false, false, true)));
            Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(new StaffState(CallerId, "Paolo Reyes", callerRole, true, false, false, true)));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new CreateCompanyExpenseHandler(Expenses, Reader, Categories, Staff, new FixedCalendar(), Unit, request, new CreateCompanyExpenseRequestValidator());
        }

        public ICompanyExpenses Expenses { get; }

        public ICompanyExpenseReader Reader { get; }

        public IExpenseCategories Categories { get; }

        public IStaffDirectory Staff { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public CreateCompanyExpenseHandler Handler { get; }

        private static CompanyExpenseDetailView Detail() => new(
            Guid.NewGuid(),
            new DateOnly(2026, 10, 25),
            new ExpenseCategoryRef(CategoryId, "Supplies", "warning", false),
            "Thread and needles",
            640.00m,
            null,
            new ActorRef(PayerId, "Mina Mercado", false),
            true,
            new ActorRef(Guid.NewGuid(), "Abel Aquino", false),
            Now,
            null,
            null,
            Version,
            Guid.NewGuid(),
            PayerId);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
