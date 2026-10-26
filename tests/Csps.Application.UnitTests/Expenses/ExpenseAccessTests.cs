using Csps.Application.Expenses;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>D-26: a Manager edits any expense; an Admin edits only one they recorded or that names them as the payer.</summary>
public sealed class ExpenseAccessTests
{
    private static readonly Guid Caller = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Other = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly Guid Another = Guid.Parse("3e9c5a07-d184-4f2b-8a63-b1f0c7d2e945");

    [Fact]
    public void ManagerEditsAnyExpense() => ExpenseAccess.CanEdit(Other, Another, Caller, callerIsManager: true).ShouldBeTrue();

    [Fact]
    public void AdminEditsAnExpenseTheyRecorded() => ExpenseAccess.CanEdit(Caller, Other, Caller, callerIsManager: false).ShouldBeTrue();

    [Fact]
    public void AdminEditsAnExpenseThatNamesThemAsThePayer() => ExpenseAccess.CanEdit(Other, Caller, Caller, callerIsManager: false).ShouldBeTrue();

    [Fact]
    public void AdminDoesNotEditSomeoneElsesExpense() => ExpenseAccess.CanEdit(Other, Another, Caller, callerIsManager: false).ShouldBeFalse();

    [Fact]
    public void AdminDoesNotEditASystemRecordTheyDidNotPay() => ExpenseAccess.CanEdit(null, Other, Caller, callerIsManager: false).ShouldBeFalse();

    [Fact]
    public void AdminEditsASystemRecordTheyPaid() => ExpenseAccess.CanEdit(null, Caller, Caller, callerIsManager: false).ShouldBeTrue();
}
