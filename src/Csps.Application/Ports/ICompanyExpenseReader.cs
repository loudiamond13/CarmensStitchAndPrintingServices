using Csps.Application.Expenses;
using Csps.Application.Users;

namespace Csps.Application.Ports;

/// <summary>Read access to company expenses. Application never sees EF: the implementation maps to these records.</summary>
public interface ICompanyExpenseReader
{
    /// <summary>Reads one expense with its category, payer, recorder and last changer. A soft-deleted expense is not found.</summary>
    /// <param name="id">The expense id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The detail, or null when no live expense has that id.</returns>
    Task<CompanyExpenseDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken);
}

/// <summary>One company expense as the read port returns it.</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The day the money was spent.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Notes">The notes; null when none.</param>
/// <param name="PaidBy">The payer, with the former-staff flag.</param>
/// <param name="PaidByActive">True while the payer passes the payer rule (D-32).</param>
/// <param name="RecordedBy">The creator; null reads as System.</param>
/// <param name="CreatedAtUtc">When it was recorded.</param>
/// <param name="LastChangedBy">The last editor; null when never edited or System.</param>
/// <param name="UpdatedAtUtc">When it was last changed; null when never.</param>
/// <param name="RowVersion">The row version, eight bytes.</param>
/// <param name="CreatedById">The creator's id, for the edit rule; null reads as System.</param>
/// <param name="PaidByUserId">The payer's id, for the edit rule.</param>
public sealed record CompanyExpenseDetailView(
    Guid Id,
    DateOnly Date,
    ExpenseCategoryRef Category,
    string Description,
    decimal Amount,
    string? Notes,
    ActorRef PaidBy,
    bool PaidByActive,
    ActorRef? RecordedBy,
    DateTimeOffset CreatedAtUtc,
    ActorRef? LastChangedBy,
    DateTimeOffset? UpdatedAtUtc,
    byte[] RowVersion,
    Guid? CreatedById,
    Guid PaidByUserId);
