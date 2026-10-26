namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because an expense row still uses the category being deleted: the foreign key from the expenses found
/// it first, as when an expense is added in the same moment the delete is decided (D-10, D-30). It is an
/// <see cref="InvalidOperationException"/>, so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class CategoryInUseException()
    : InvalidOperationException("This category is used by an expense, so it can't be deleted.");
