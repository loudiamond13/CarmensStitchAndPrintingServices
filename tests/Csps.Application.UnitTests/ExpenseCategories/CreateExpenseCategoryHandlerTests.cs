using Csps.Application.ExpenseCategories;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.ExpenseCategories;

/// <summary>D-08, D-13, D-27, OQ-10: a category is checked, named uniquely, saved once with its audit entry, and a lost name race is a field error.</summary>
public sealed class CreateExpenseCategoryHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task AValidCategoryIsTrimmedAddedAuditedAndSavedOnce()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new CreateExpenseCategoryRequest(" Laundry ", "info"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var added = harness.Added.ShouldHaveSingleItem();
        added.Name.ShouldBe("Laundry");
        added.Tone.ShouldBe("info");
        result.Value.ShouldBe(new ExpenseCategoryListItem(added.Id, "Laundry", "info", "active", false, 0));
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Audit.Entries.ShouldHaveSingleItem().ShouldBe(new AuditCall(
            AuditActions.ExpenseCategoryAdded,
            "ExpenseCategory",
            added.Id.ToString("D"),
            "name=Laundry;tone=info",
            Independent: false));
    }

    [Fact]
    public async Task TheNameIsLookedUpNormalizedAndTheAuditNameIsPercentEncoded()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new CreateExpenseCategoryRequest("Tea; snacks=1", "neutral"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Categories.Received(1).NameTakenAsync("TEA; SNACKS=1", null, Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("name=Tea%3B snacks%3D1;tone=neutral");
    }

    [Fact]
    public async Task AnEmptyRequestListsTheNameAndToneErrorsAndWritesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CreateExpenseCategoryRequest.Empty, TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(["name: Enter a category name.", "tone: Choose a badge color."]);
        result.Error.Code.ShouldBe("expense-categories.invalid-request");
        harness.Unit.Saves.ShouldBe(0);
        harness.Added.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
        await harness.Categories.DidNotReceive().NameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFortyOneCharacterNameIsRefused()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new CreateExpenseCategoryRequest(new string('a', 41), "info"), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(["name: Keep the name to 40 characters or fewer."]);
    }

    [Fact]
    public async Task ANameAnotherCategoryHoldsIsAFieldErrorAlongsideABadTone()
    {
        var harness = new Harness(nameTaken: true);

        var result = await harness.Handler.HandleAsync(new CreateExpenseCategoryRequest("Rent", "danger"), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(["name: Another category already has this name.", "tone: Choose a badge color."]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALostNameRaceIsTheSameFieldErrorAndTheTransactionRollsBack()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new CategoryNameTakenException());

        var result = await harness.Handler.HandleAsync(new CreateExpenseCategoryRequest("Laundry", "info"), TestContext.Current.CancellationToken);

        Fields(result).ShouldBe(["name: Another category already has this name."]);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    private static List<string> Fields(Result result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        return [.. result.Error.FieldErrors.ShouldNotBeNull().SelectMany(pair => pair.Value.Select(message => $"{pair.Key}: {message}")).Order(StringComparer.Ordinal)];
    }

    private sealed class Harness
    {
        public Harness(bool nameTaken = false)
        {
            Categories = Substitute.For<IExpenseCategories>();
            Categories.NameTakenAsync(Arg.Any<string>(), Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(nameTaken);
            Categories.When(store => store.Add(Arg.Any<ExpenseCategory>())).Do(call => Added.Add(call.Arg<ExpenseCategory>()));
            Handler = new CreateExpenseCategoryHandler(
                Categories,
                Audit,
                Unit,
                new FakeTimeProvider(Now),
                new CreateExpenseCategoryRequestValidator());
        }

        public IExpenseCategories Categories { get; }

        public List<ExpenseCategory> Added { get; } = [];

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public CreateExpenseCategoryHandler Handler { get; }
    }
}
