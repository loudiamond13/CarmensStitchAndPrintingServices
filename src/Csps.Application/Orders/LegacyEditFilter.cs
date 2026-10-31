using Csps.Application.Ports;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>
/// Lets an edit leave a field as saved (D-49b). The edit forms share the New Order rules, which an imported legacy value may break
/// (an amount over the cap, a date ahead, a quantity of 0, no contact number). When the form fails, the order is read once and any
/// failure on a field whose value is the one saved is dropped; a failure on a field the edit changes stands. A form that passes
/// never reads the order here, and the domain still checks every changed field against the order it loads.
/// </summary>
internal static class LegacyEditFilter
{
    /// <summary>Drops the failures on fields the edit leaves as saved.</summary>
    /// <param name="validation">The result of the form validator.</param>
    /// <param name="reader">The order reader.</param>
    /// <param name="orderId">The order being edited.</param>
    /// <param name="leftAsSaved">Names the validator properties whose values equal the saved ones, judged against the order as read.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The result without those failures; the same result when it was valid or the order cannot be read.</returns>
    public static async Task<ValidationResult> RelaxAsync(
        ValidationResult validation,
        IOrderReader reader,
        Guid orderId,
        Func<OrderDetailResponse, IReadOnlySet<string>> leftAsSaved,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(validation);
        if (validation.IsValid)
        {
            return validation;
        }

        var view = await reader.GetDetailAsync(orderId, cancellationToken).ConfigureAwait(false);
        if (view is null)
        {
            return validation;
        }

        var same = leftAsSaved(view);
        return new ValidationResult(validation.Errors.Where(failure => !same.Contains(failure.PropertyName)));
    }

    /// <summary>Collects the names of the properties flagged as unchanged.</summary>
    /// <param name="fields">Each validator property name with whether the form value equals the saved one.</param>
    /// <returns>The names of the unchanged properties.</returns>
    public static IReadOnlySet<string> Unchanged(params (string Property, bool Same)[] fields) =>
        fields.Where(static field => field.Same).Select(static field => field.Property).ToHashSet(StringComparer.Ordinal);
}
