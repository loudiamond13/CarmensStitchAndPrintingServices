namespace Csps.Domain.Money;

/// <summary>How the transfer rules see a person's account (D-19, D-56). The Application maps Manager-locked and not-yet-set-up staff to <see cref="Active"/>.</summary>
public enum MoneyPartyStatus
{
    /// <summary>A current Admin or Manager who can send and receive.</summary>
    Active,

    /// <summary>Former staff whose account was deactivated.</summary>
    Deactivated,

    /// <summary>Former staff whose account was deleted.</summary>
    Deleted,

    /// <summary>Not a staff member at all, such as an unknown id.</summary>
    NotStaff,
}
