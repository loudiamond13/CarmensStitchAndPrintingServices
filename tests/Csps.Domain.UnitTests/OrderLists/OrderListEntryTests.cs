using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;

namespace Csps.Domain.UnitTests.OrderLists;

/// <summary>D-19: every managed list entry keeps the Phase 6 category rules; only the order expense Others is protected.</summary>
public sealed class OrderListEntryTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 9, 0, 0, TimeSpan.Zero);

    public static TheoryData<OrderListKind, string, string> Kinds => new()
    {
        { OrderListKind.ProductType, "product-types", "product type" },
        { OrderListKind.PaymentMethod, "payment-methods", "payment method" },
        { OrderListKind.OrderExpenseCategory, "order-expense-categories", "category" },
    };

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateTrimsTheNameKeepsTheToneAndNormalizesForTheUniqueIndex(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;

        var entry = Created(kind, "  Sample  ");

        entry.Name.ShouldBe("Sample");
        entry.NormalizedName.ShouldBe("SAMPLE");
        entry.Tone.ShouldBe("info");
        entry.IsRetired.ShouldBeFalse();
        entry.RetiredAtUtc.ShouldBeNull();
        entry.IsOthers.ShouldBeFalse();
        entry.CreatedAtUtc.ShouldBe(Now);
        entry.CreatedById.ShouldBeNull();
        entry.RowVersion.ShouldBeEmpty();
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateMakesAVersionSevenIdFromTheInstant(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;

        var id = Created(kind, "Sample").Id;

        id.Version.ShouldBe(7);
        id.ToByteArray(bigEndian: true).Take(6).Aggregate(0L, (total, next) => (total << 8) | next).ShouldBe(Now.ToUnixTimeMilliseconds());
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateAcceptsAFortyCharacterNameAndEveryTone(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;

        Create(kind, new string('a', OrderListEntry.NameMaxLength), CategoryTones.Neutral).IsSuccess.ShouldBeTrue();
        foreach (var tone in CategoryTones.All)
        {
            Create(kind, "Sample", tone).IsSuccess.ShouldBeTrue();
        }
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateRefusesAnEmptyNameInPlainWords(OrderListKind kind, string prefix, string noun)
    {
        foreach (var name in new[] { string.Empty, "   " })
        {
            Rejected(Create(kind, name, CategoryTones.Info), prefix, "name", $"Enter a {noun} name.");
        }
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateRefusesAFortyOneCharacterNameAfterTrimming(OrderListKind kind, string prefix, string noun)
    {
        _ = noun;

        Rejected(Create(kind, new string('a', 41), CategoryTones.Info), prefix, "name", "Keep the name to 40 characters or fewer.");
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void CreateRefusesAToneOutsideTheSix(OrderListKind kind, string prefix, string noun)
    {
        _ = noun;

        foreach (var tone in new[] { "danger", "Info", string.Empty })
        {
            Rejected(Create(kind, "Sample", tone), prefix, "tone", "Choose a badge color.");
        }
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void RenameChangesTheNameAndReturnsTheOldOneAndTheSameNameChangesNothing(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;
        var entry = Created(kind, "Sample");

        var renamed = entry.Rename("  Other name ");
        var same = entry.Rename("Other name");

        renamed.Value.ShouldBe("Sample");
        same.Value.ShouldBe("Other name");
        entry.Name.ShouldBe("Other name");
        entry.NormalizedName.ShouldBe("OTHER NAME");
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void RenameRefusesBadNamesAndKeepsTheOldOne(OrderListKind kind, string prefix, string noun)
    {
        var entry = Created(kind, "Sample");

        Rejected(entry.Rename("   "), prefix, "name", $"Enter a {noun} name.");
        Rejected(entry.Rename(new string('a', 41)), prefix, "name", "Keep the name to 40 characters or fewer.");
        entry.Name.ShouldBe("Sample");
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void RecolorChangesTheToneAndRefusesOneOutsideTheSix(OrderListKind kind, string prefix, string noun)
    {
        _ = noun;
        var entry = Created(kind, "Sample");

        var result = entry.Recolor(CategoryTones.Success);
        Rejected(entry.Recolor("danger"), prefix, "tone", "Choose a badge color.");

        result.Value.ShouldBe("info");
        entry.Tone.ShouldBe("success");
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void RetireMarksTheEntryRetiredAndASecondRetireChangesNothing(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;
        var entry = Created(kind, "Sample");

        var first = entry.Retire(Now.AddHours(1));
        var second = entry.Retire(Now.AddHours(2));

        first.Value.ShouldBeTrue();
        second.IsSuccess.ShouldBeTrue();
        second.Value.ShouldBeFalse();
        entry.IsRetired.ShouldBeTrue();
        entry.RetiredAtUtc.ShouldBe(Now.AddHours(1));
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public void ReactivateClearsTheRetirementAndAnActiveEntryChangesNothing(OrderListKind kind, string prefix, string noun)
    {
        _ = prefix;
        _ = noun;
        var entry = Created(kind, "Sample");
        entry.Retire(Now);

        var first = entry.Reactivate();
        var second = entry.Reactivate();

        first.ShouldBeTrue();
        second.ShouldBeFalse();
        entry.IsRetired.ShouldBeFalse();
        entry.RetiredAtUtc.ShouldBeNull();
    }

    [Theory]
    [InlineData(OrderListKind.ProductType)]
    [InlineData(OrderListKind.PaymentMethod)]
    public void ProductTypesAndPaymentMethodsHaveNoProtectedEntry(OrderListKind kind)
    {
        OrderListSeed.Rows(kind).ShouldAllBe(row => !FromSeed(kind, row).IsOthers);
        FromSeed(kind, OrderListSeed.Rows(kind)[0]).Retire(Now).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void FromSeedKeepsTheSeedValuesAndHasNoRetirementOrAttribution()
    {
        var row = OrderListSeed.PaymentMethods[1];

        var entry = PaymentMethod.FromSeed(row);

        entry.Id.ShouldBe(row.Id);
        entry.Name.ShouldBe("GCash");
        entry.NormalizedName.ShouldBe("GCASH");
        entry.Tone.ShouldBe(row.Tone);
        entry.CreatedAtUtc.ShouldBe(OrderListSeed.SeededAtUtc);
        entry.RetiredAtUtc.ShouldBeNull();
        entry.CreatedById.ShouldBeNull();
        entry.UpdatedById.ShouldBeNull();
        entry.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void OnlyTheOrderExpenseOthersIsOthers()
    {
        OrderListSeed.OrderExpenseCategories.Where(row => OrderExpenseCategory.FromSeed(row).IsOthers).Select(row => row.Name).ShouldBe(["Others"]);
    }

    [Fact]
    public void OthersCannotBeRenamedButKeepsItsNameWhenTheSameNameIsSent()
    {
        var others = Others();

        Rejected(others.Rename("Misc"), "order-expense-categories", "name", "The Others name can't change.");
        others.Name.ShouldBe("Others");
        others.Rename("Others").IsSuccess.ShouldBeTrue();
        others.Name.ShouldBe("Others");
    }

    [Fact]
    public void OthersCannotBeRetiredAndTheErrorIsTheProtectedOne()
    {
        var others = Others();

        var result = others.Retire(Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("order-expense-categories.protected");
        result.Error.Message.ShouldBe("The Others category can't be renamed, retired or deleted.");
        others.IsRetired.ShouldBeFalse();
        others.Protected().Code.ShouldBe("order-expense-categories.protected");
    }

    [Fact]
    public void OthersCanBeRecoloredToAnyTone()
    {
        var others = Others();

        foreach (var tone in CategoryTones.All)
        {
            others.Recolor(tone).IsSuccess.ShouldBeTrue();
            others.Tone.ShouldBe(tone);
        }
    }

    [Fact]
    public void NormalizeTrimsAndUpperCasesInvariantly()
    {
        OrderListEntry.Normalize("  Ink & paper ").ShouldBe("INK & PAPER");
    }

    private static Result Create(OrderListKind kind, string name, string tone) => kind switch
    {
        OrderListKind.ProductType => ProductType.Create(name, tone, Now),
        OrderListKind.PaymentMethod => PaymentMethod.Create(name, tone, Now),
        _ => OrderExpenseCategory.Create(name, tone, Now),
    };

    private static OrderListEntry Created(OrderListKind kind, string name) => kind switch
    {
        OrderListKind.ProductType => ProductType.Create(name, CategoryTones.Info, Now).Value,
        OrderListKind.PaymentMethod => PaymentMethod.Create(name, CategoryTones.Info, Now).Value,
        _ => OrderExpenseCategory.Create(name, CategoryTones.Info, Now).Value,
    };

    private static OrderListEntry FromSeed(OrderListKind kind, OrderListSeedRow row) => kind switch
    {
        OrderListKind.ProductType => ProductType.FromSeed(row),
        OrderListKind.PaymentMethod => PaymentMethod.FromSeed(row),
        _ => OrderExpenseCategory.FromSeed(row),
    };

    private static OrderExpenseCategory Others() =>
        OrderExpenseCategory.FromSeed(OrderListSeed.OrderExpenseCategories.Single(row => row.Id == OrderListSeed.OrderExpenseOthersId));

    private static void Rejected(Result result, string prefix, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe($"{prefix}.invalid-request");
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.ShouldContainKey(field);
        fields[field].ShouldBe([message]);
    }
}
