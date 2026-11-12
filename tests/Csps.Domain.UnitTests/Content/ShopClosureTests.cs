using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>CONT-04, D-21: a closure is one to 31 days, never starts in the past when new, keeps its past first day on an edit, and knows when it overlaps another.</summary>
public sealed class ShopClosureTests
{
    private static readonly DateOnly Today = new(2026, 12, 1);
    private static readonly DateTimeOffset Now = new(2026, 12, 1, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public void DecemberTwentyFourToTwentyFiveAndTwentySixToTwentySevenDoNotOverlapBecauseTheyOnlyTouch() =>
        Closure("2026-12-24", "2026-12-25").Overlaps(Closure("2026-12-26", "2026-12-27")).ShouldBeFalse();

    [Fact]
    public void AClosureStartingTheDayAfterTheOtherEndsDoesNotOverlapItEither() =>
        Closure("2026-12-26", "2026-12-27").Overlaps(Closure("2026-12-24", "2026-12-25")).ShouldBeFalse();

    [Fact]
    public void RangesSharingOneDayOverlapInBothDirections()
    {
        var first = Closure("2026-12-24", "2026-12-26");
        var second = Closure("2026-12-26", "2026-12-28");

        first.Overlaps(second).ShouldBeTrue();
        second.Overlaps(first).ShouldBeTrue();
    }

    [Fact]
    public void ARangeInsideAnotherOverlaps() => Closure("2026-12-20", "2026-12-30").Overlaps(Closure("2026-12-25", null)).ShouldBeTrue();

    [Fact]
    public void TheFirstSharedDayIsTheLaterOfTheTwoFirstDays()
    {
        Closure("2026-12-24", "2026-12-26").FirstSharedDay(Closure("2026-12-25", null)).ShouldBe(new DateOnly(2026, 12, 25));
        Closure("2026-12-20", "2026-12-26").FirstSharedDay(Closure("2026-12-24", "2026-12-30")).ShouldBe(new DateOnly(2026, 12, 24));
        Closure("2026-12-25", null).FirstSharedDay(Closure("2026-12-20", "2026-12-26")).ShouldBe(new DateOnly(2026, 12, 25));
    }

    [Fact]
    public void ClosuresThatDoNotOverlapHaveNoSharedDay() =>
        Closure("2026-12-24", null).FirstSharedDay(Closure("2026-12-26", null)).ShouldBeNull();

    [Fact]
    public void OverlapTakesAClosureNotNull() =>
        Should.Throw<ArgumentNullException>(() => Closure("2026-12-24", null).Overlaps(null!));

    [Fact]
    public void FirstSharedDayTakesAClosureNotNull() =>
        Should.Throw<ArgumentNullException>(() => Closure("2026-12-24", null).FirstSharedDay(null!));

    [Fact]
    public void TheOverlapMessageNamesTheDayInTheShortPhilippineForm() =>
        ShopClosure.OverlapMessage(new DateOnly(2026, 12, 25)).ShouldBe("There's already a closure on Dec 25, 2026.");

    [Fact]
    public void ALastDayLeftOutMakesOneDay()
    {
        var closure = Closure("2026-12-25", null);

        closure.FirstDay.ShouldBe(new DateOnly(2026, 12, 25));
        closure.LastDay.ShouldBe(new DateOnly(2026, 12, 25));
        closure.Span.ShouldBe(new ClosureSpan(new DateOnly(2026, 12, 25), new DateOnly(2026, 12, 25), null));
    }

    [Fact]
    public void AnEmptyNoteIsNoneAndAPaddedNoteIsTrimmed()
    {
        Closure("2026-12-25", null, "   ").Note.ShouldBeNull();
        Closure("2026-12-25", null, "  Christmas ").Note.ShouldBe("Christmas");
        ShopClosure.NormalizeNote(null).ShouldBeNull();
    }

    [Fact]
    public void AFirstDayOfYesterdayIsRefusedAndTodayPasses()
    {
        ShopClosure.Create(Today.AddDays(-1), null, null, Today, Now).Error.FieldErrors!["firstDay"].ShouldBe(["Pick today or a later date."]);
        ShopClosure.Create(Today, null, null, Today, Now).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void ALastDayBeforeTheFirstIsRefused() =>
        Check("2026-12-25", "2026-12-24", null)["lastDay"].ShouldBe(["The last day must be on or after the first day."]);

    [Fact]
    public void ThirtyOneDaysPassAndThirtyTwoAreRefused()
    {
        Check("2026-12-01", "2026-12-31", null).ShouldBeEmpty();
        Check("2026-12-01", "2027-01-01", null)["lastDay"].ShouldBe(["A closure can be up to 31 days. Add another one for longer."]);
    }

    [Fact]
    public void ANoteOfEightyCharactersPassesAndEightyOneIsRefused()
    {
        Check("2026-12-25", null, new string('a', 80)).ShouldBeEmpty();
        Check("2026-12-25", null, new string('a', 81))["note"].ShouldBe(["Keep the note to 80 characters or fewer."]);
        Check("2026-12-25", null, new string(' ', 5) + new string('a', 80) + new string(' ', 5)).ShouldBeEmpty();
    }

    [Fact]
    public void AFailedCreateReportsEveryBrokenField()
    {
        var failed = ShopClosure.Create(Today.AddDays(-1), Today.AddDays(-3), new string('a', 81), Today, Now);

        failed.IsFailure.ShouldBeTrue();
        failed.Error.FieldErrors!.Keys.ShouldBe(["firstDay", "lastDay", "note"], ignoreOrder: true);
    }

    [Fact]
    public void ChangingTheNoteOfAClosureThatAlreadyStartedKeepsItsPastFirstDay()
    {
        var closure = Closure("2026-11-28", "2026-12-03", "Old");

        var changed = closure.Change(new DateOnly(2026, 11, 28), new DateOnly(2026, 12, 3), "New", Today);

        changed.IsSuccess.ShouldBeTrue();
        changed.Value.ShouldBe(new ShopClosureChange(new DateOnly(2026, 11, 28), new DateOnly(2026, 12, 3), new DateOnly(2026, 11, 28), new DateOnly(2026, 12, 3), NoteChanged: true));
        closure.Note.ShouldBe("New");
    }

    [Fact]
    public void MovingTheFirstDayIntoThePastIsRefusedAndChangesNothing()
    {
        var closure = Closure("2026-12-10", "2026-12-12");

        var changed = closure.Change(Today.AddDays(-1), new DateOnly(2026, 12, 12), null, Today);

        changed.Error.FieldErrors!["firstDay"].ShouldBe(["Pick today or a later date."]);
        closure.FirstDay.ShouldBe(new DateOnly(2026, 12, 10));
    }

    [Fact]
    public void ChangingTheDaysReportsOldAndNewAndLeavesTheNoteAlone()
    {
        var closure = Closure("2026-12-10", "2026-12-12", "Holiday");

        var changed = closure.Change(new DateOnly(2026, 12, 11), new DateOnly(2026, 12, 14), "Holiday", Today);

        changed.Value.ShouldBe(new ShopClosureChange(new DateOnly(2026, 12, 10), new DateOnly(2026, 12, 12), new DateOnly(2026, 12, 11), new DateOnly(2026, 12, 14), NoteChanged: false));
        closure.FirstDay.ShouldBe(new DateOnly(2026, 12, 11));
        closure.LastDay.ShouldBe(new DateOnly(2026, 12, 14));
    }

    [Fact]
    public void TheSameDaysAndNoteChangeNothing()
    {
        var closure = Closure("2026-12-10", "2026-12-12", "Holiday");

        closure.Change(new DateOnly(2026, 12, 10), new DateOnly(2026, 12, 12), " Holiday ", Today).Value.ShouldBeNull();
    }

    [Fact]
    public void ALastDayLeftOutOnAnEditMakesOneDay()
    {
        var closure = Closure("2026-12-10", "2026-12-12");

        var changed = closure.Change(new DateOnly(2026, 12, 10), null, null, Today);

        changed.Value!.NewLastDay.ShouldBe(new DateOnly(2026, 12, 10));
        closure.LastDay.ShouldBe(new DateOnly(2026, 12, 10));
    }

    [Fact]
    public void RemovingTheNoteIsANoteChange()
    {
        var closure = Closure("2026-12-10", null, "Holiday");

        closure.Change(new DateOnly(2026, 12, 10), null, "  ", Today).Value!.NoteChanged.ShouldBeTrue();
        closure.Note.ShouldBeNull();
    }

    private static Dictionary<string, string[]> Check(string first, string? last, string? note) =>
        ShopClosure.Check(Day(first), last is null ? null : Day(last), note, Today, requireFirstDayFromToday: true);

    private static ShopClosure Closure(string first, string? last, string? note = null) =>
        ShopClosure.Create(Day(first), last is null ? null : Day(last), note, DateOnly.MinValue, Now).Value;

    private static DateOnly Day(string text) => DateOnly.ParseExact(text, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
}
