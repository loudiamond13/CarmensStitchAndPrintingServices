namespace Csps.Application.Expenses;

/// <summary>
/// The stored values of the expense an edit changes. The new-expense limits (amount cap, description and notes length) apply only to
/// a value the edit changes, so an imported row over a limit stays editable (D-33).
/// </summary>
/// <param name="Description">The stored description, trimmed.</param>
/// <param name="Amount">The stored amount.</param>
/// <param name="Notes">The stored notes; null when none.</param>
public sealed record StoredExpenseFields(string Description, decimal Amount, string? Notes);
