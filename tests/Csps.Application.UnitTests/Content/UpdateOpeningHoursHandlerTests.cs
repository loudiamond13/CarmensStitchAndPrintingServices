using System.Reflection;
using Csps.Application.Common;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;
using FluentValidation.Results;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-01, SEC-07, AUDIT-01: saving the weekly hours runs its steps in one order and stops at the first failure: the form is checked
/// (400), the week version is the stored one (409), then the days are set. A save with no change stores nothing and writes no audit
/// entry. A change writes one entry naming each changed day.
/// </summary>
public sealed class UpdateOpeningHoursHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ASaveThatChangesTwoDaysSavesOnceAndWritesOneAuditEntry()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Harness.Request(Week((1, "09:00", "18:00"), (6, "09:00", "17:00"))), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.OpeningHoursChanged);
        entry.TargetType.ShouldBe("OpeningHours");
        entry.TargetId.ShouldBe("week");
        entry.Independent.ShouldBeFalse();
        entry.Detail.ShouldBe("monday=closed>09:00-18:00;saturday=closed>09:00-17:00");
        harness.Rows[0].OpensAt.ShouldBe(new TimeOnly(9, 0));
        harness.Rows[5].ClosesAt.ShouldBe(new TimeOnly(17, 0));
    }

    [Fact]
    public async Task ASaveWithNoChangeStoresNothingAndWritesNoAuditEntry()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Harness.Request(Week()), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionIs409AndChangesNothing()
    {
        var harness = new Harness();
        var stale = Harness.Request(Week((1, "09:00", "18:00"))) with { Version = OpeningHoursVersion.ToText([.. Enumerable.Repeat<byte[]>([0, 0, 0, 0, 0, 0, 0, 9], 7)]) };

        var result = await harness.Handler.HandleAsync(stale, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(EditErrors.StaleCode);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Rows[0].OpensAt.ShouldBeNull();
    }

    [Fact]
    public async Task ALostRaceOnSaveIs409()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(Harness.Request(Week((1, "09:00", "18:00"))), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(EditErrors.StaleCode);
    }

    [Fact]
    public async Task AFormTheValidatorRefusesIs400WithTheFieldErrorsAndTouchesNoRow()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Harness.Request(Week((1, "18:00", "09:00"))), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        result.Error.FieldErrors!["days[0].closesAt"].ShouldBe(["Closing time must be after opening time."]);
        _ = harness.Store.DidNotReceive().GetHoursForUpdateAsync(Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ADayTheDomainRefusesIs400OnThatDayEvenWhenTheValidatorLetsItThrough()
    {
        var harness = new Harness(validator: new PassingValidator());

        var result = await harness.Handler.HandleAsync(Harness.Request(Week((2, "09:15", "18:00"))), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(SiteContentErrors.InvalidCode);
        result.Error.FieldErrors!["days[1].opensAt"].ShouldBe([OpeningHours.TimeStepMessage]);
        harness.Unit.Saves.ShouldBe(0);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ReturnsTheStoredHoursAfterASave()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Harness.Request(Week((1, "09:00", "18:00"))), TestContext.Current.CancellationToken);

        result.Value.Days.Count.ShouldBe(7);
        await harness.Store.Received(1).GetHoursViewAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError() =>
        await Should.ThrowAsync<ArgumentNullException>(() => new Harness().Handler.HandleAsync(null!, TestContext.Current.CancellationToken));

    private static List<DayHoursDto> Week(params (int Day, string Opens, string Closes)[] open) =>
        [.. Enumerable.Range(1, 7).Select(day =>
        {
            var hours = open.FirstOrDefault(entry => entry.Day == day);
            return hours.Opens is null ? new DayHoursDto(day, null, null) : new DayHoursDto(day, hours.Opens, hours.Closes);
        })];

    private sealed class PassingValidator : IValidator<UpdateOpeningHoursRequest>
    {
        public ValidationResult Validate(UpdateOpeningHoursRequest instance) => new();

        public Task<ValidationResult> ValidateAsync(UpdateOpeningHoursRequest instance, CancellationToken cancellation = default) => Task.FromResult(new ValidationResult());

        public ValidationResult Validate(IValidationContext context) => new();

        public Task<ValidationResult> ValidateAsync(IValidationContext context, CancellationToken cancellation = default) => Task.FromResult(new ValidationResult());

        public IValidatorDescriptor CreateDescriptor() => throw new NotSupportedException();

        public bool CanValidateInstancesOfType(Type type) => true;
    }

    private sealed class Harness
    {
        private static readonly byte[] RowVersion = [0, 0, 0, 0, 0, 0, 0x1F, 0xA4];

        public Harness(IValidator<UpdateOpeningHoursRequest>? validator = null)
        {
            Rows =
            [
                .. Enumerable.Range(1, 7).Select(day =>
                {
                    var row = OpeningHours.Closed(day, Now);
                    typeof(OpeningHours).GetProperty(nameof(OpeningHours.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(row, RowVersion);
                    return row;
                }),
            ];

            Store = Substitute.For<ISiteContentStore>();
            Store.GetHoursForUpdateAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<IReadOnlyList<OpeningHours>>(Rows));
            Store.GetHoursViewAsync(Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(View()));
            Handler = new UpdateOpeningHoursHandler(Store, Audit, Unit, validator ?? new UpdateOpeningHoursRequestValidator());
        }

        public List<OpeningHours> Rows { get; }

        public ISiteContentStore Store { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public UpdateOpeningHoursHandler Handler { get; }

        public static UpdateOpeningHoursRequest Request(List<DayHoursDto> days) =>
            new(OpeningHoursVersion.ToText([.. Enumerable.Repeat(RowVersion, 7)]), days);

        private static OpeningHoursView View() => new(
            [.. Enumerable.Range(1, 7).Select(day => new OpeningHoursRowView(day, null, null, RowVersion))],
            null,
            null);
    }
}
