namespace Csps.Application.Expenses;

/// <summary>The one rule for who may edit an expense (D-26), used by the detail, the list and the save so they never disagree.</summary>
public static class ExpenseAccess
{
    /// <summary>
    /// A Manager may edit any expense. An Admin may edit an expense they recorded or that names them as the payer.
    /// A row with no creator (System) can be edited by an Admin only when they are the payer.
    /// </summary>
    /// <param name="createdById">Who recorded the expense; null reads as System.</param>
    /// <param name="paidByUserId">Who paid.</param>
    /// <param name="callerId">The signed-in user.</param>
    /// <param name="callerIsManager">True when the caller has the Manager role.</param>
    /// <returns>True when the caller may edit the expense.</returns>
    public static bool CanEdit(Guid? createdById, Guid paidByUserId, Guid callerId, bool callerIsManager) =>
        callerIsManager || createdById == callerId || paidByUserId == callerId;
}
