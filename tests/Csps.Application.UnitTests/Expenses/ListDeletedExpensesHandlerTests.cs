using Csps.Application.Auth;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Users;
using NSubstitute;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-02, D-07, SEC-03, WEB-10, OR-3: the deleted list checks its query first, passes a trimmed search and a parsed category to the port, and maps rows without notes.</summary>
public sealed class ListDeletedExpensesHandlerTests
{
    private static readonly DateTimeOffset DeletedAt = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Reader.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ABadQueryIsA400NamingEveryFieldAndThePortIsNeverCalled()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(Category: "nope", Page: 0, PageSize: 101), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(Csps.Domain.Common.ErrorKind.Validation);
        result.Error.Code.ShouldBe("company-expenses.invalid-request");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["category", "page", "pageSize"]);
        harness.Reader.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEmptyQueryAsksForPageOneOfTwentyWithNoFilters()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListDeletedAsync(new DeletedExpenseListQuery(null, null, 1, 20), Arg.Any<CancellationToken>());
        (result.Value.Page, result.Value.PageSize, result.Value.Total).ShouldBe((1, 20, 0));
        result.Value.Items.ShouldBeEmpty();
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

        await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(Q: typed), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListDeletedAsync(Arg.Is<DeletedExpenseListQuery>(query => query.Search == sent), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public async Task ABlankCategoryMeansAllCategories(string? category)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(Category: category), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListDeletedAsync(Arg.Is<DeletedExpenseListQuery>(query => query.CategoryId == null), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ADashedCategoryAndThePageAreHandedToThePort()
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(Category: $" {CategoryId:D} ", Page: 3, PageSize: 50), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListDeletedAsync(new DeletedExpenseListQuery(CategoryId, null, 3, 50), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RowsAreMappedWithTheTotalAndTheEchoedPage()
    {
        var harness = new Harness();
        var category = new ExpenseCategoryRef(CategoryId, "Supplies", "warning", false);
        var payer = new ActorRef(Guid.NewGuid(), "Mina Mercado", false);
        var deleter = new ActorRef(CallerId, "Paolo Reyes", true);
        var id = Guid.NewGuid();
        harness.Reader.ListDeletedAsync(Arg.Any<DeletedExpenseListQuery>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(new DeletedExpensePage(
            [
                new DeletedExpenseRow(id, DeletedAt, deleter, new DateOnly(2026, 10, 20), category, "Thread and needles", 640.00m, payer),
                new DeletedExpenseRow(Guid.NewGuid(), DeletedAt.AddMinutes(-1), null, new DateOnly(2026, 10, 19), category, "Fabric", 10.50m, payer),
            ],
            7)));

        var result = await harness.Handler.HandleAsync(new ListDeletedExpensesRequest(Page: 2, PageSize: 2), TestContext.Current.CancellationToken);

        result.Value.Total.ShouldBe(7);
        (result.Value.Page, result.Value.PageSize).ShouldBe((2, 2));
        result.Value.Items.Count.ShouldBe(2);
        result.Value.Items[0].ShouldBe(new DeletedExpenseListItem(id, DeletedAt, deleter, new DateOnly(2026, 10, 20), category, "Thread and needles", 640.00m, payer));
        result.Value.Items[1].DeletedBy.ShouldBeNull();
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public void TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        new ListDeletedExpensesRequestValidator().Validate(new ListDeletedExpensesRequest(Page: page, PageSize: pageSize)).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(100_001, 20, "Page", "Use a page from 1 to 100000.")]
    [InlineData(1, 0, "PageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "PageSize", "Use a page size from 1 to 100.")]
    public void APageOrSizeOutsideItsRangeIsRefusedWithTheListWords(int page, int pageSize, string field, string message)
    {
        var result = new ListDeletedExpensesRequestValidator().Validate(new ListDeletedExpensesRequest(Page: page, PageSize: pageSize));

        var error = result.Errors.ShouldHaveSingleItem();
        error.PropertyName.ShouldBe(field);
        error.ErrorMessage.ShouldBe(message);
    }

    [Fact]
    public void ASearchOfOneHundredCharactersPassesAndOneHundredAndOneIsRefused()
    {
        var validator = new ListDeletedExpensesRequestValidator();

        validator.Validate(new ListDeletedExpensesRequest(Q: new string('a', 100))).IsValid.ShouldBeTrue();
        validator.Validate(new ListDeletedExpensesRequest(Q: new string('a', 101))).Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Use 100 characters or fewer.");
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("447ad32e14334b70878672e3dc3f9937")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void AnythingButADashedIdAsACategoryIsRefused(string category)
    {
        var error = new ListDeletedExpensesRequestValidator().Validate(new ListDeletedExpensesRequest(Category: category)).Errors.ShouldHaveSingleItem();

        error.PropertyName.ShouldBe("Category");
        error.ErrorMessage.ShouldBe("Choose a category from the list.");
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Reader = Substitute.For<ICompanyExpenseReader>();
            Reader.ListDeletedAsync(Arg.Any<DeletedExpenseListQuery>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(new DeletedExpensePage([], 0)));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ListDeletedExpensesHandler(Reader, request, new ListDeletedExpensesRequestValidator());
        }

        public ICompanyExpenseReader Reader { get; }

        public ListDeletedExpensesHandler Handler { get; }
    }
}
