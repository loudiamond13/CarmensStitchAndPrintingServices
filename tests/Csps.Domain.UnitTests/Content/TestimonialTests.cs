using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// CONT-03, D-05, SEC-08: a testimonial keeps what a Manager typed inside its rules. Every message is the approved wording, the limits
/// hold at their edges, an edit names what changed, and hide, show and swap behave.
/// </summary>
public sealed class TestimonialTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);

    private static TestimonialValues Valid { get; } = new("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", "Captain, Brgy. Sample Ballers", 5, true);

    [Fact]
    public void TheConstantsAreTheApprovedLimitsAndWording()
    {
        Testimonial.QuoteMaxLength.ShouldBe(300);
        Testimonial.NameMaxLength.ShouldBe(60);
        Testimonial.TeamMaxLength.ShouldBe(80);
        Testimonial.MinStars.ShouldBe(1);
        Testimonial.MaxStars.ShouldBe(5);
        Testimonial.QuoteRequiredMessage.ShouldBe("Enter the quote.");
        Testimonial.QuoteTooLongMessage.ShouldBe("Keep the quote to 300 characters or fewer.");
        Testimonial.NameRequiredMessage.ShouldBe("Enter the name.");
        Testimonial.NameTooLongMessage.ShouldBe("Keep the name to 60 characters or fewer.");
        Testimonial.TeamTooLongMessage.ShouldBe("Keep this to 80 characters or fewer.");
        Testimonial.StarsInvalidMessage.ShouldBe("Choose 1 to 5 stars.");
    }

    [Fact]
    public void AValidFormHasNoErrors() => Testimonial.Check(Valid).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingQuoteOrNameIsRefusedWithTheRequiredMessage(string? text)
    {
        var errors = Testimonial.Check(Valid with { Quote = text, Name = text });

        errors["quote"].ShouldBe(["Enter the quote."]);
        errors["name"].ShouldBe(["Enter the name."]);
    }

    [Fact]
    public void ALongQuoteIsJudgedAfterTrimmingAndRefusedOverThreeHundred()
    {
        Testimonial.Check(Valid with { Quote = " " + new string('q', 300) + " " }).ShouldBeEmpty();

        Testimonial.Check(Valid with { Quote = new string('q', 301) })["quote"].ShouldBe(["Keep the quote to 300 characters or fewer."]);
    }

    [Fact]
    public void ALongNameIsRefusedOverSixty()
    {
        Testimonial.Check(Valid with { Name = new string('n', 60) }).ShouldBeEmpty();

        Testimonial.Check(Valid with { Name = new string('n', 61) })["name"].ShouldBe(["Keep the name to 60 characters or fewer."]);
    }

    [Fact]
    public void ALongTeamLineIsRefusedOverEightyAndAMissingOneIsFine()
    {
        Testimonial.Check(Valid with { TeamOrRole = new string('t', 80) }).ShouldBeEmpty();
        Testimonial.Check(Valid with { TeamOrRole = null }).ShouldBeEmpty();
        Testimonial.Check(Valid with { TeamOrRole = "   " }).ShouldBeEmpty();

        Testimonial.Check(Valid with { TeamOrRole = new string('t', 81) })["teamOrRole"].ShouldBe(["Keep this to 80 characters or fewer."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0d)]
    [InlineData(6d)]
    [InlineData(-1d)]
    [InlineData(2.5)]
    public void StarsOutsideOneToFiveOrNotWholeAreRefused(double? stars)
    {
        var errors = Testimonial.Check(Valid with { Stars = stars is null ? null : (decimal)stars.Value });

        errors["stars"].ShouldBe(["Choose 1 to 5 stars."]);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void OneToFiveWholeStarsAreAccepted(int stars) => Testimonial.Check(Valid with { Stars = stars }).ShouldBeEmpty();

    [Fact]
    public void CreateKeepsTrimmedValuesPutsItAtThePositionAndIsHiddenUnlessShown()
    {
        var shown = Testimonial.Create(Valid with { Quote = "  Great.  ", TeamOrRole = "  Captain  " }, 3, Now);
        var hidden = Testimonial.Create(Valid with { IsShown = null }, 1, Now);

        shown.IsSuccess.ShouldBeTrue();
        shown.Value.Quote.ShouldBe("Great.");
        shown.Value.TeamOrRole.ShouldBe("Captain");
        shown.Value.Name.ShouldBe("Juan Dela Cruz");
        shown.Value.Stars.ShouldBe(5);
        shown.Value.Position.ShouldBe(3);
        shown.Value.IsShown.ShouldBeTrue();
        shown.Value.CreatedAtUtc.ShouldBe(Now);
        shown.Value.Id.ShouldNotBe(Guid.Empty);
        hidden.Value.IsShown.ShouldBeFalse();
    }

    [Fact]
    public void AnEmptyTeamLineIsKeptAsNone()
    {
        Testimonial.Create(Valid with { TeamOrRole = "   " }, 1, Now).Value.TeamOrRole.ShouldBeNull();
    }

    [Fact]
    public void CreateNamesEveryBrokenFieldInOneValidationError()
    {
        var result = Testimonial.Create(new TestimonialValues(null, null, new string('t', 81), 9, null), 1, Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["quote", "name", "teamOrRole", "stars"], ignoreOrder: true);
    }

    [Fact]
    public void CreateRefusesAPositionBelowOneAndNullValues()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => Testimonial.Create(Valid, 0, Now));
        Should.Throw<ArgumentNullException>(() => Testimonial.Create(null!, 1, Now));
        Should.Throw<ArgumentNullException>(() => Testimonial.Check(null!));
        Should.Throw<ArgumentNullException>(() => Testimonial.Create(Valid, 1, Now).Value.Update(null!));
        Should.Throw<ArgumentNullException>(() => Testimonial.Create(Valid, 1, Now).Value.SwapPositionWith(null!));
    }

    [Fact]
    public void UpdateNamesTheChangedFieldsInFormOrderAndKeepsTheOldNameAndStars()
    {
        var testimonial = Testimonial.Create(Valid, 1, Now).Value;

        var result = testimonial.Update(new TestimonialValues("New words.", "Ana", null, 4, null));

        result.IsSuccess.ShouldBeTrue();
        result.Value.Fields.ShouldBe(["quote", "name", "teamOrRole", "stars"]);
        result.Value.OldName.ShouldBe("Juan Dela Cruz");
        result.Value.NewName.ShouldBe("Ana");
        result.Value.OldStars.ShouldBe(5);
        result.Value.NewStars.ShouldBe(4);
        result.Value.NowShown.ShouldBeNull();
        result.Value.HasChange.ShouldBeTrue();
        testimonial.TeamOrRole.ShouldBeNull();
        testimonial.IsShown.ShouldBeTrue();
    }

    [Fact]
    public void UpdateWithTheSameValuesChangesNothing()
    {
        var testimonial = Testimonial.Create(Valid, 1, Now).Value;

        var result = testimonial.Update(Valid);

        result.Value.HasChange.ShouldBeFalse();
        result.Value.Fields.ShouldBeEmpty();
    }

    [Fact]
    public void UpdateFlipsTheShownFlagWhenGivenOneAndKeepsItWhenNot()
    {
        var testimonial = Testimonial.Create(Valid, 1, Now).Value;

        testimonial.Update(Valid with { IsShown = false }).Value.NowShown.ShouldBe(false);
        testimonial.IsShown.ShouldBeFalse();
        testimonial.Update(Valid with { IsShown = null }).Value.NowShown.ShouldBeNull();
        testimonial.IsShown.ShouldBeFalse();
        var shown = testimonial.Update(Valid with { IsShown = true });
        shown.Value.NowShown.ShouldBe(true);
        shown.Value.HasChange.ShouldBeTrue();
        shown.Value.Fields.ShouldBeEmpty();
    }

    [Fact]
    public void AFailedUpdateChangesNothing()
    {
        var testimonial = Testimonial.Create(Valid, 1, Now).Value;

        var result = testimonial.Update(Valid with { Quote = "Changed.", Stars = 9 });

        result.IsFailure.ShouldBeTrue();
        testimonial.Quote.ShouldBe("Seventeen pieces, names and numbers perfect.");
        testimonial.Stars.ShouldBe(5);
    }

    [Fact]
    public void HideAndShowReportWhetherTheyChangedAnything()
    {
        var testimonial = Testimonial.Create(Valid, 1, Now).Value;

        testimonial.Hide().ShouldBeTrue();
        testimonial.Hide().ShouldBeFalse();
        testimonial.IsShown.ShouldBeFalse();
        testimonial.Show().ShouldBeTrue();
        testimonial.Show().ShouldBeFalse();
        testimonial.IsShown.ShouldBeTrue();
    }

    [Fact]
    public void SwapTradesPlaces()
    {
        var first = Testimonial.Create(Valid, 1, Now).Value;
        var second = Testimonial.Create(Valid, 2, Now).Value;

        first.SwapPositionWith(second);

        first.Position.ShouldBe(2);
        second.Position.ShouldBe(1);
    }
}
