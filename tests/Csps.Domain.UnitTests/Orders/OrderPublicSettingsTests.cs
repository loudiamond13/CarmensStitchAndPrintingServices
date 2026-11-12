using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>D-09 to D-13, D-38, SEC-08: the public settings need the customer's OK, take the consent's who and when from the caller and the clock, and skip the Completed lock but not the Cancelled refusal.</summary>
public sealed class OrderPublicSettingsTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Latest = new(2026, 10, 30, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid Admin = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid Manager = Guid.Parse("2f9a6d10-58b3-4c7e-8a41-d03e7b95c628");
    private static readonly Guid Basketball = Guid.Parse("a5e3b9c1-0d74-4e28-8f16-3c2a7d5b9e40");
    private static readonly Guid Volleyball = Guid.Parse("b6f4c0d2-1e85-4f39-9a27-4d3b8e6c0f51");
    private static readonly Guid Moto = Guid.Parse("c7a5d1e3-2f96-4a4a-8b38-5e4c9f7d1a62");

    private static readonly OrderPublicSettings Shown = new(true, true, null, null);

    [Fact]
    public void AFreshOrderHasNoConsentIsNotShownAndHoldsNoChoice()
    {
        var order = NewOrder();

        order.HasCustomerConsent.ShouldBeFalse();
        order.IsShownOnWebsite.ShouldBeFalse();
        order.PublicConsentAtUtc.ShouldBeNull();
        order.PublicConsentById.ShouldBeNull();
        order.ShownOnWebsiteSinceUtc.ShouldBeNull();
        order.PublicProductLineId.ShouldBeNull();
        order.PublicName.ShouldBeNull();
    }

    [Fact]
    public void ShowingWithoutTheCustomerOkIsRefusedAndChangesNothing()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;

        var result = order.SetPublicSettings(new OrderPublicSettings(false, true, null, null), Admin, Basketball, Later);

        var fields = Refused(result);
        fields.Keys.ShouldBe(["showOnWebsite"]);
        fields["showOnWebsite"].ShouldBe(["Tick Customer said OK to show first."]);
        order.EditVersion.ShouldBe(editVersion);
        order.IsShownOnWebsite.ShouldBeFalse();
        order.HasCustomerConsent.ShouldBeFalse();
    }

    [Fact]
    public void RecordingTheOkStampsTheCallerAndTheClockAndNothingElse()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;

        var result = order.SetPublicSettings(new OrderPublicSettings(true, false, null, null), Admin, Basketball, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ConsentChange.ShouldBe(true);
        result.Value.ShownChange.ShouldBeNull();
        order.PublicConsentAtUtc.ShouldBe(Later);
        order.PublicConsentById.ShouldBe(Admin);
        order.IsShownOnWebsite.ShouldBeFalse();
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void ShowingStampsWhenItWentOnTheWebsite()
    {
        var order = NewOrder();

        var result = order.SetPublicSettings(Shown, Admin, Basketball, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShownChange.ShouldBe(true);
        order.ShownOnWebsiteSinceUtc.ShouldBe(Later);
    }

    [Fact]
    public void SavingTheSameSettingsAgainKeepsTheOriginalWhoWhenAndSinceAndTheEditVersion()
    {
        var order = NewOrder();
        order.SetPublicSettings(Shown, Admin, Basketball, Later).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var again = order.SetPublicSettings(Shown, Manager, Basketball, Latest);

        again.IsSuccess.ShouldBeTrue();
        again.Value.HasAny.ShouldBeFalse();
        order.PublicConsentById.ShouldBe(Admin);
        order.PublicConsentAtUtc.ShouldBe(Later);
        order.ShownOnWebsiteSinceUtc.ShouldBe(Later);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void RemovingTheOkAlsoTakesTheOrderOffTheWebsite()
    {
        var order = NewOrder();
        order.SetPublicSettings(Shown, Admin, Basketball, Later).IsSuccess.ShouldBeTrue();

        var result = order.SetPublicSettings(new OrderPublicSettings(false, false, null, null), Manager, Basketball, Latest);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ConsentChange.ShouldBe(false);
        result.Value.ShownChange.ShouldBe(false);
        order.HasCustomerConsent.ShouldBeFalse();
        order.PublicConsentById.ShouldBeNull();
        order.IsShownOnWebsite.ShouldBeFalse();
    }

    [Fact]
    public void RemovingTheOkWhileKeepingItShownIsRefused()
    {
        var order = NewOrder();
        order.SetPublicSettings(Shown, Admin, Basketball, Later).IsSuccess.ShouldBeTrue();

        var result = order.SetPublicSettings(new OrderPublicSettings(false, true, null, null), Manager, Basketball, Latest);

        Refused(result)["showOnWebsite"].ShouldBe(["Tick Customer said OK to show first."]);
        order.HasCustomerConsent.ShouldBeTrue();
        order.IsShownOnWebsite.ShouldBeTrue();
    }

    [Fact]
    public void TakingAnOrderOffKeepsTheOk()
    {
        var order = NewOrder();
        order.SetPublicSettings(Shown, Admin, Basketball, Later).IsSuccess.ShouldBeTrue();

        var result = order.SetPublicSettings(new OrderPublicSettings(true, false, null, null), Manager, Basketball, Latest);

        result.Value.ShownChange.ShouldBe(false);
        result.Value.ConsentChange.ShouldBeNull();
        order.HasCustomerConsent.ShouldBeTrue();
        order.PublicConsentById.ShouldBe(Admin);
        order.IsShownOnWebsite.ShouldBeFalse();
    }

    [Fact]
    public void ACancelledOrderCannotBeShownAndNothingChanges()
    {
        var order = NewOrder();
        order.ChangeStatus(OrderStatus.Cancelled, Admin, Later).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var result = order.SetPublicSettings(Shown, Admin, Basketball, Latest);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("orders.public-cancelled");
        result.Error.Message.ShouldBe("Cancelled orders can't be shown on the website.");
        order.EditVersion.ShouldBe(editVersion);
        order.HasCustomerConsent.ShouldBeFalse();
    }

    [Fact]
    public void ACompletedOrderCanBeShownBecauseTheEditLockDoesNotApply()
    {
        var order = NewOrder();
        order.ChangeStatus(OrderStatus.Completed, Admin, Later).IsSuccess.ShouldBeTrue();
        order.UpdateDetails(ValidDetails(), Latest).IsFailure.ShouldBeTrue();

        var result = order.SetPublicSettings(Shown, Manager, Basketball, Latest);

        result.IsSuccess.ShouldBeTrue();
        order.Status.ShouldBe(OrderStatus.Completed);
        order.IsShownOnWebsite.ShouldBeTrue();
    }

    [Fact]
    public void AnOrderWithNoTeamAndNoNameToShowIsRefused()
    {
        var order = NewOrder(teamName: null);

        var result = order.SetPublicSettings(Shown, Admin, Basketball, Later);

        var fields = Refused(result);
        fields.Keys.ShouldBe(["publicName"]);
        fields["publicName"].ShouldBe(["This order has no team name. Enter the name to show."]);
    }

    [Fact]
    public void AnOrderWithNoTeamIsShownUnderTheNameTypedAndTheNameIsTrimmed()
    {
        var order = NewOrder(teamName: null);

        var result = order.SetPublicSettings(new OrderPublicSettings(true, true, null, "  Tondo Riders MC  "), Admin, Basketball, Later);

        result.IsSuccess.ShouldBeTrue();
        order.PublicName.ShouldBe("Tondo Riders MC");
        result.Value.DetailFields.ShouldBe(["name"]);
    }

    [Fact]
    public void AnOrderWithNoTeamMayRecordTheOkWithoutANameUntilItIsShown()
    {
        var order = NewOrder(teamName: null);

        var result = order.SetPublicSettings(new OrderPublicSettings(true, false, null, null), Admin, Basketball, Later);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ABlankNameMeansTheTeamShows()
    {
        var order = NewOrder();
        order.SetPublicSettings(new OrderPublicSettings(false, false, null, "Hidden Team"), Admin, Basketball, Later).IsSuccess.ShouldBeTrue();

        var result = order.SetPublicSettings(new OrderPublicSettings(false, false, null, "   "), Admin, Basketball, Latest);

        result.IsSuccess.ShouldBeTrue();
        order.PublicName.ShouldBeNull();
        result.Value.DetailFields.ShouldBe(["name"]);
    }

    [Fact]
    public void ANameOf81CharactersIsRefusedAndOneOf80IsKept()
    {
        var order = NewOrder();

        var tooLong = order.SetPublicSettings(new OrderPublicSettings(false, false, null, new string('a', 81)), Admin, Basketball, Later);
        var fits = order.SetPublicSettings(new OrderPublicSettings(false, false, null, new string('a', 80)), Admin, Basketball, Later);

        Refused(tooLong)["publicName"].ShouldBe(["Keep the name to 80 characters or fewer."]);
        fits.IsSuccess.ShouldBeTrue();
        order.PublicName!.Length.ShouldBe(80);
    }

    [Fact]
    public void ShowingWithNoLineToShowItUnderIsRefused()
    {
        var order = NewOrder();

        var result = order.SetPublicSettings(Shown, Admin, null, Later);

        var fields = Refused(result);
        fields.Keys.ShouldBe(["productLineId"]);
        fields["productLineId"].ShouldBe(["Choose the product line to show this order under."]);
    }

    [Fact]
    public void ALineChosenByStaffAnswersWhenTheItemsFileUnderNoLine()
    {
        var order = NewOrder();

        var result = order.SetPublicSettings(new OrderPublicSettings(true, true, Volleyball, null), Admin, null, Later);

        result.IsSuccess.ShouldBeTrue();
        order.PublicProductLineId.ShouldBe(Volleyball);
    }

    [Fact]
    public void EveryBrokenFieldIsReportedTogether()
    {
        var order = NewOrder(teamName: null);

        var result = order.SetPublicSettings(new OrderPublicSettings(false, true, null, null), Admin, null, Later);

        Refused(result).Keys.Order(StringComparer.Ordinal).ShouldBe(["productLineId", "publicName", "showOnWebsite"]);
    }

    [Fact]
    public void ChoosingTheAutoLineStoresNoOverrideAndChoosingAnotherStoresIt()
    {
        var order = NewOrder();

        order.SetPublicSettings(new OrderPublicSettings(true, true, Basketball, null), Admin, Basketball, Later).IsSuccess.ShouldBeTrue();
        order.PublicProductLineId.ShouldBeNull();

        var other = order.SetPublicSettings(new OrderPublicSettings(true, true, Volleyball, null), Admin, Basketball, Latest);

        order.PublicProductLineId.ShouldBe(Volleyball);
        other.Value.DetailFields.ShouldBe(["line"]);

        var back = order.SetPublicSettings(new OrderPublicSettings(true, true, null, null), Admin, Basketball, Latest);

        order.PublicProductLineId.ShouldBeNull();
        back.Value.DetailFields.ShouldBe(["line"]);
    }

    [Fact]
    public void WithNoAutoLineAndNoChoiceTheOkIsRecordedAndNoLineIsStored()
    {
        var order = NewOrder();

        var result = order.SetPublicSettings(new OrderPublicSettings(true, false, null, null), Admin, null, Later);

        result.IsSuccess.ShouldBeTrue();
        order.PublicProductLineId.ShouldBeNull();
        result.Value.DetailFields.ShouldBeEmpty();
    }

    [Fact]
    public void AnOverrideSavedAgainIsNoChangeAndAnotherOverrideReplacesIt()
    {
        var order = NewOrder();
        order.SetPublicSettings(new OrderPublicSettings(true, false, Volleyball, null), Admin, Basketball, Later).IsSuccess.ShouldBeTrue();

        var same = order.SetPublicSettings(new OrderPublicSettings(true, false, Volleyball, null), Admin, Basketball, Latest);
        var other = order.SetPublicSettings(new OrderPublicSettings(true, false, Moto, null), Admin, Basketball, Latest);

        same.Value.HasAny.ShouldBeFalse();
        other.Value.DetailFields.ShouldBe(["line"]);
        order.PublicProductLineId.ShouldBe(Moto);
    }

    [Fact]
    public void ALineAndANameChangeAreNamedInThatOrder()
    {
        var order = NewOrder();

        var result = order.SetPublicSettings(new OrderPublicSettings(false, false, Volleyball, "Sample Name"), Admin, Basketball, Later);

        result.Value.DetailFields.ShouldBe(["line", "name"]);
        result.Value.HasAny.ShouldBeTrue();
    }

    [Fact]
    public void ANullSettingsValueIsRefused() =>
        Should.Throw<ArgumentNullException>(() => NewOrder().SetPublicSettings(null!, Admin, null, Later));

    private static Dictionary<string, string[]> Refused(Result<OrderPublicSettingsChanges> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        return new Dictionary<string, string[]>(result.Error.FieldErrors.ShouldNotBeNull());
    }

    private static OrderDetails ValidDetails(string? teamName = "Brgy. San Roque Ballers") =>
        new("Juan Dela Cruz", teamName, "0917 123 4567", "juan.dc@example.com", null, Today, Today.AddDays(14), null);

    // The items cost nothing, so the balance is zero and the order can be Completed.
    private static Order NewOrder(string? teamName = "Brgy. San Roque Ballers")
    {
        var input = new NewOrder(ValidDetails(teamName), OrderStatus.Pending, [new NewOrderItem(JerseyType, "Jersey top", null, 17, 0.00m)]);
        return Order.Create(input, Admin, Created, Today).Value;
    }
}
