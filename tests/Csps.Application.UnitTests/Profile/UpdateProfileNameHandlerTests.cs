using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Profile;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using NSubstitute;

namespace Csps.Application.UnitTests.Profile;

/// <summary>PROF-01, USER-06, D-40: a real name change is audited with field names only; nothing else is written.</summary>
public sealed class UpdateProfileNameHandlerTests
{
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");
    private static readonly Guid OpenedVersion = Guid.Parse("9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72");
    private static readonly Guid SavedVersion = Guid.Parse("e5a3b7c9-1d24-4f68-b0a2-7c9e1f3d5b84");

    [Fact]
    public async Task AFirstNameChangeRecordsOneEntryWithTheFieldNameOnly()
    {
        var harness = new Harness();

        var result = await harness.SaveAsync("Ana", "Reyes");

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.name-changed", "User", UserId.ToString("D"), "fields=first-name", Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ALastNameChangeRecordsTheLastNameField()
    {
        var harness = new Harness();

        await harness.SaveAsync("Paolo", "Cruz");

        harness.Audit.Entries.Select(static entry => entry.Detail).ShouldBe(["fields=last-name"]);
    }

    [Fact]
    public async Task BothNamesChangedRecordsBothFieldsInOrder()
    {
        var harness = new Harness();

        await harness.SaveAsync("Ana", "Cruz");

        harness.Audit.Entries.Select(static entry => entry.Detail).ShouldBe(["fields=first-name,last-name"]);
    }

    [Fact]
    public async Task NoEntryHoldsTheOldOrTheNewName()
    {
        var harness = new Harness();

        await harness.SaveAsync("Ana", "Cruz");

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        var written = $"{entry.Action} {entry.TargetType} {entry.TargetId} {entry.Detail}";
        foreach (var name in new[] { "Ana", "Cruz", "Paolo", "Reyes" })
        {
            written.ShouldNotContain(name);
        }
    }

    [Fact]
    public async Task NamesAreTrimmedBeforeTheyAreCompared()
    {
        var harness = new Harness { Outcome = EditOutcome.Unchanged };

        await harness.SaveAsync("  Paolo ", " Reyes\t");

        await harness.Accounts.Received(1).UpdateNameAsync(UserId, "Paolo", "Reyes", OpenedVersion, Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ASaveThatChangesNothingWritesNoEntryAndKeepsTheVersion()
    {
        var harness = new Harness { Outcome = EditOutcome.Unchanged };

        var result = await harness.SaveAsync("Paolo", "Reyes");

        result.IsSuccess.ShouldBeTrue();
        result.Value.Version.ShouldBe(OpenedVersion);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AStaleSaveIsRefusedAndWritesNoEntry()
    {
        var harness = new Harness { Outcome = EditOutcome.Stale };

        var result = await harness.SaveAsync("Ana", "Cruz");

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnAccountThatVanishedMidSaveIsASessionEndedAndWritesNoEntry()
    {
        var harness = new Harness { Outcome = EditOutcome.NotFound };

        var result = await harness.SaveAsync("Ana", "Cruz");

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task NoUserInTheRequestIsASessionEndedAndTouchesNothing()
    {
        var harness = new Harness { SignedIn = false };

        var result = await harness.SaveAsync("Ana", "Cruz");

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.NoWritesAttempted();
    }

    [Fact]
    public async Task AnUnknownAccountIsASessionEndedAndWritesNothing()
    {
        var harness = new Harness { Known = false };

        var result = await harness.SaveAsync("Ana", "Cruz");

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        harness.NoWritesAttempted();
    }

    [Theory]
    [InlineData("", "Reyes", "9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72")]
    [InlineData("Paolo", "   ", "9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72")]
    [InlineData("Paolo", "Reyes", "not-a-guid")]
    [InlineData("Paolo", "Reyes", null)]
    public async Task InvalidFieldsNeverReachThePortsOrTheAuditLog(string firstName, string lastName, string? version)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new UpdateProfileNameRequest(firstName, lastName, version), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        harness.NoWritesAttempted();
    }

    [Fact]
    public async Task TheEntryAndTheSaveShareOneTransaction()
    {
        var harness = new Harness();

        await harness.SaveAsync("Ana", "Cruz");

        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    private sealed class Harness
    {
        public Harness()
        {
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.UpdateNameAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult(new EditResult(Outcome, Outcome switch
                {
                    EditOutcome.Saved => SavedVersion,
                    EditOutcome.NotFound => Guid.Empty,
                    _ => OpenedVersion,
                })));
        }

        public IUserAccounts Accounts { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public EditOutcome Outcome { get; init; } = EditOutcome.Saved;

        public bool SignedIn { get; init; } = true;

        public bool Known { get; init; } = true;

        public UpdateProfileNameHandler Handler => Build();

        public Task<Result<ProfileResponse>> SaveAsync(string firstName, string lastName) =>
            Handler.HandleAsync(new UpdateProfileNameRequest(firstName, lastName, OpenedVersion.ToString("D")), TestContext.Current.CancellationToken);

        public void NoWritesAttempted()
        {
            Accounts.DidNotReceiveWithAnyArgs().UpdateNameAsync(default, default!, default!, default, default);
            Audit.Entries.ShouldBeEmpty();
            Unit.Saves.ShouldBe(0);
        }

        private UpdateProfileNameHandler Build()
        {
            var directory = Substitute.For<IUserDirectory>();
            directory.GetProfileAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProfileView?>(
                Known ? new ProfileView(UserId, "Paolo", "Reyes", "staff@example.test", "Admin", null, DateTimeOffset.UnixEpoch, OpenedVersion) : null));

            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(SignedIn ? UserId : null);

            return new UpdateProfileNameHandler(Accounts, directory, request, new UpdateProfileNameRequestValidator(), Audit, Unit);
        }
    }
}
