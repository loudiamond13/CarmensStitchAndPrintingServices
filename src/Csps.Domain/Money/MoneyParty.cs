namespace Csps.Domain.Money;

/// <summary>A person's id, name, staff status and money on hand, as the transfer rules see them. The handler reads the figures under the lock.</summary>
/// <param name="Id">The person's id; an empty id means nobody was chosen.</param>
/// <param name="Name">The person's display name, used in messages.</param>
/// <param name="Status">Whether the person is current staff, former staff or not staff.</param>
/// <param name="Balance">Their money on hand; below zero when they are owed money.</param>
public readonly record struct MoneyParty(Guid Id, string Name, MoneyPartyStatus Status, decimal Balance)
{
    /// <summary>Gets a value indicating whether the person is former staff (deactivated or deleted).</summary>
    public bool IsLeaver => Status is MoneyPartyStatus.Deactivated or MoneyPartyStatus.Deleted;
}
