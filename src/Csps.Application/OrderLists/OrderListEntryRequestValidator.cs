using Csps.Application.Common;
using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;
using FluentValidation;

namespace Csps.Application.OrderLists;

/// <summary>
/// The one set of field rules for adding and editing an order list entry (OR-3, D-19): a name of 1 to 40 characters after trimming,
/// a tone that is one of the six and, when editing, a version of eight bytes. The handler passes the list through
/// <see cref="KindKey"/> so the messages use the right noun, and sets <see cref="EditKey"/> for an edit. Whether the name is
/// already used needs the database and runs in the handlers.
/// </summary>
public sealed class OrderListEntryRequestValidator : AbstractValidator<OrderListEntryRequest>
{
    /// <summary>The validation context key that holds the <see cref="OrderListKind"/>.</summary>
    public const string KindKey = "orderListKind";

    /// <summary>The validation context key that holds true when the form is an edit and the version is required.</summary>
    public const string EditKey = "orderListEdit";

    /// <summary>Creates the validator.</summary>
    public OrderListEntryRequestValidator()
    {
        RuleFor(request => request.Name).Custom(static (text, context) =>
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                context.AddFailure(NameRequired(context.RootContextData));
            }
            else if (text.Trim().Length > OrderListEntry.NameMaxLength)
            {
                context.AddFailure(OrderListEntry.NameTooLongMessage);
            }
        });

        RuleFor(request => request.Tone)
            .Must(static tone => CategoryTones.IsValid(tone)).WithMessage(OrderListEntry.ToneInvalidMessage);

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage)
            .When(static (_, context) => context.RootContextData.TryGetValue(EditKey, out var edit) && edit is true);
    }

    private static string NameRequired(IDictionary<string, object> data) =>
        data.TryGetValue(KindKey, out var kind) && kind is OrderListKind known ? $"Enter a {OrderListDescriptor.For(known).Noun} name." : "Enter a name.";
}
