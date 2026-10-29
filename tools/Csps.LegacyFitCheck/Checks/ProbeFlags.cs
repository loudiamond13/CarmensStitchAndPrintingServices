using Csps.Domain.Orders;

namespace Csps.LegacyFitCheck.Checks;

/// <summary>Which part of an order a relaxation is judged on.</summary>
internal enum ProbeScope
{
    /// <summary>The details field groups, the number and the status history.</summary>
    Details,

    /// <summary>One item, discount, payment, refund or expense on its own.</summary>
    Child,

    /// <summary>The worked-out figures of the whole order.</summary>
    Figures,

    /// <summary>Read by the import handler, not by the order, so it is not probed (counted from the mapping and the trial import).</summary>
    Handler,
}

/// <summary>One relaxation of the import rules and how to turn it off.</summary>
/// <param name="Name">The property name on <see cref="OrderImportRules"/>.</param>
/// <param name="Scope">The part of the order where it is judged.</param>
/// <param name="TurnOff">The default rules with only this relaxation off.</param>
internal sealed record ProbeFlag(string Name, ProbeScope Scope, Func<OrderImportRules, OrderImportRules> TurnOff);

/// <summary>
/// The table of every relaxation. A test checks by reflection that each bool on <see cref="OrderImportRules"/> is here exactly once,
/// so a flag added later cannot be left out of the check.
/// </summary>
internal static class ProbeFlags
{
    public static IReadOnlyList<ProbeFlag> All { get; } =
    [
        new("KeepLegacyNumber", ProbeScope.Details, static rules => rules with { KeepLegacyNumber = false }),
        new("DueDateOptional", ProbeScope.Details, static rules => rules with { DueDateOptional = false }),
        new("ContactNumberOptional", ProbeScope.Details, static rules => rules with { ContactNumberOptional = false }),
        new("AllowAnyStatusHistory", ProbeScope.Details, static rules => rules with { AllowAnyStatusHistory = false }),
        new("IgnoreAmountCaps", ProbeScope.Child, static rules => rules with { IgnoreAmountCaps = false }),
        new("AllowFutureDates", ProbeScope.Child, static rules => rules with { AllowFutureDates = false }),
        new("AllowOverpaid", ProbeScope.Figures, static rules => rules with { AllowOverpaid = false }),
        new("AllowCompletedWithBalance", ProbeScope.Figures, static rules => rules with { AllowCompletedWithBalance = false }),
        new("AllowDiscountAboveSubtotal", ProbeScope.Figures, static rules => rules with { AllowDiscountAboveSubtotal = false }),
        new("IgnoreChildCaps", ProbeScope.Figures, static rules => rules with { IgnoreChildCaps = false }),
        new("AllowNoItems", ProbeScope.Figures, static rules => rules with { AllowNoItems = false }),
        new("AllowRetiredListEntries", ProbeScope.Handler, static rules => rules with { AllowRetiredListEntries = false }),
        new("AllowLegacyHolder", ProbeScope.Handler, static rules => rules with { AllowLegacyHolder = false }),
        new("AllowInactivePeople", ProbeScope.Handler, static rules => rules with { AllowInactivePeople = false }),
    ];

    /// <summary>Gets the flags judged on one scope.</summary>
    /// <param name="scope">The scope.</param>
    /// <returns>The flags of that scope, in table order.</returns>
    public static IEnumerable<ProbeFlag> For(ProbeScope scope) => All.Where(flag => flag.Scope == scope);
}
