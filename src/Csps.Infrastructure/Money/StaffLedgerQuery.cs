using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Money;

/// <summary>The ledger union for one staff member (MONEY-02). Not built yet: every read returns nothing.</summary>
internal static class StaffLedgerQuery
{
    public static IQueryable<StaffLedgerRow> For(CspsDbContext context, Guid userId) => Array.Empty<StaffLedgerRow>().AsQueryable();

    public static IQueryable<StaffLedgerRow> Ordered(IQueryable<StaffLedgerRow> rows) => rows;

    public static Task<IReadOnlyList<StaffLedgerRow>> PageAsync(IQueryable<StaffLedgerRow> ordered, int page, int pageSize, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<StaffLedgerRow>>([]);
}
