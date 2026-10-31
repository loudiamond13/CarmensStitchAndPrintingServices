namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because the category an expense points at was deleted after the handler checked it: the foreign key
/// from the expenses refused the insert or the update, as when a Manager deletes a never-used category in the same moment someone
/// saves an expense in it (D-10). The handler answers it like an unknown category. It is an <see cref="InvalidOperationException"/>,
/// so a caller that does not expect it still fails loudly.
/// </summary>
public sealed class CategoryDeletedException()
    : InvalidOperationException("The category was deleted before the expense was saved.");
