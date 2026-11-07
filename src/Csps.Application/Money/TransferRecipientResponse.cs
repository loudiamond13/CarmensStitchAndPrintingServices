namespace Csps.Application.Money;

/// <summary>
/// One person the transfer window may offer in its To list (D-19, D-49, D-56). It has a name and a status word only: nothing about
/// what the person holds or is owed, for any caller.
/// </summary>
/// <param name="Id">The person's id.</param>
/// <param name="Name">The first and last name.</param>
/// <param name="Status">One of <c>active</c>, <c>deactivated</c> or <c>deleted</c>.</param>
/// <param name="IsYou">True for the signed-in person.</param>
public sealed record TransferRecipientResponse(Guid Id, string Name, string Status, bool IsYou)
{
    /// <summary>The status of a current Admin or Manager, a locked or not-yet-set-up one included.</summary>
    public const string ActiveStatus = "active";

    /// <summary>The status of a deactivated former staff member who is owed money.</summary>
    public const string DeactivatedStatus = "deactivated";

    /// <summary>The status of a deleted former staff member who is owed money.</summary>
    public const string DeletedStatus = "deleted";
}
