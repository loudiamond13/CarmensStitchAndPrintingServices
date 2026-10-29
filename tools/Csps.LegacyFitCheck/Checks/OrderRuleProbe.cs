using System.Globalization;
using System.Text.RegularExpressions;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Findings;

namespace Csps.LegacyFitCheck.Checks;

/// <summary>
/// Reports every rule one legacy order breaks or relies on (D-03). The public import returns only the first broken field, so the
/// order is cut into parts, each wrapped in a neutral order that passes the strict rules, and the public import runs on each part.
/// The rules come only from the import itself: nothing is copied here. Within one field only the first message shows.
/// </summary>
internal static partial class OrderRuleProbe
{
    /// <summary>Probes one mapped order.</summary>
    /// <param name="legacyKey">The legacy table and id of the order.</param>
    /// <param name="snapshot">The mapped order.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="today">The business today.</param>
    /// <returns>A RuleBreak per broken field and message, and a ReliesOnRelaxation per relaxation a passing part needs.</returns>
    public static IReadOnlyList<Finding> Probe(string legacyKey, OrderImportSnapshot snapshot, DateTimeOffset now, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(legacyKey);
        ArgumentNullException.ThrowIfNull(snapshot);

        var run = new Run(legacyKey, now, today);
        var neutral = NeutralOrder.Create(NeutralOrder.DateFor(snapshot.Details.OrderDate, today));

        run.Part(neutral with { Number = snapshot.Number, Details = snapshot.Details, Status = snapshot.Status, StatusHistory = snapshot.StatusHistory }, ProbeScope.Details, null, 0);
        for (var index = 0; index < snapshot.Items.Count; index++)
        {
            run.Part(neutral with { Items = [snapshot.Items[index]] }, ProbeScope.Child, OrderRules.ItemsField, index);
        }

        for (var index = 0; index < snapshot.Discounts.Count; index++)
        {
            run.Part(neutral with { Discounts = [snapshot.Discounts[index]] }, ProbeScope.Child, OrderRules.DiscountsField, index);
        }

        for (var index = 0; index < snapshot.Payments.Count; index++)
        {
            run.Part(neutral with { Payments = [snapshot.Payments[index]] }, ProbeScope.Child, OrderRules.PaymentsField, index);
        }

        for (var index = 0; index < snapshot.Expenses.Count; index++)
        {
            run.Part(neutral with { Expenses = [snapshot.Expenses[index]] }, ProbeScope.Child, OrderRules.ExpensesField, index);
        }

        return run.Findings;
    }

    [GeneratedRegex(@"\[\d+\]", RegexOptions.CultureInvariant)]
    private static partial Regex IndexPattern();

    private sealed class Run(string key, DateTimeOffset now, DateOnly today)
    {
        public List<Finding> Findings { get; } = [];

        // Runs one part under the default rules. A failure is a break. A pass is run again once per relaxation of the scope, with
        // only that relaxation off, and a failure then means the part relies on it.
        public void Part(OrderImportSnapshot part, ProbeScope scope, string? collection, int index)
        {
            var result = Order.Import(part, OrderImportRules.Default, now, today);
            if (result.IsFailure)
            {
                Findings.AddRange(Describe(FindingType.RuleBreak, null, result.Error, collection, index));
                return;
            }

            foreach (var flag in ProbeFlags.For(scope))
            {
                var relaxed = Order.Import(part, flag.TurnOff(OrderImportRules.Default), now, today);
                if (relaxed.IsFailure)
                {
                    Findings.AddRange(Describe(FindingType.ReliesOnRelaxation, flag.Name, relaxed.Error, collection, index));
                }
            }
        }

        // A part holds one child at place 0, so its path is moved to the child's real place in the order.
        private IEnumerable<Finding> Describe(FindingType type, string? flagName, Error error, string? collection, int index)
        {
            if (error.FieldErrors is not { Count: > 0 } fields)
            {
                yield return new Finding(RecordKind.Order, key, type, flagName ?? error.Code, null, error.Message, null, null);
                yield break;
            }

            foreach (var (rawPath, messages) in fields)
            {
                var path = collection is null
                    ? rawPath
                    : rawPath.Replace($"{collection}[0]", $"{collection}[{index.ToString(CultureInfo.InvariantCulture)}]", StringComparison.Ordinal);
                foreach (var message in messages)
                {
                    var rule = flagName ?? $"{IndexPattern().Replace(path, "[]")}: {message}";
                    yield return new Finding(RecordKind.Order, key, type, rule, path, message, null, null);
                }
            }
        }
    }
}
