using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>
/// USER-03, C-9, D-19, D-21, D-40: a Manager calls off another person's waiting email change. The open links die and the pending address
/// clears in one transaction under the link lock; with nothing waiting it writes nothing; an unknown, deleted or own account is refused.
/// </summary>
public sealed class CancelUserEmailChangeHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task ACancelRevokesTheLinksClearsThePendingAddressAndRecordsItUnderTheLock()
    {
        var harness = new Harness { Pending = "new.person@csps.test" };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(TargetId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
            harness.Accounts.SetPendingEmailAsync(TargetId, null, Arg.Any<CancellationToken>());
        });
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.ProfileEmailChangeCanceled, "User", TargetId.ToString("D"), null, Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task WithNothingWaitingItSucceedsAndWritesNothing()
    {
        var harness = new Harness { Pending = null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task APersonWhoHasNoProfileRowHasNothingWaiting()
    {
        var harness = new Harness { ProfileExists = false };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnUnknownOrDeletedPersonIsANotFound(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account() with { IsDeleted = true } : null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCallersOwnAccountIsRefusedBeforeAnythingIsLockedOrRead()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CallerId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithoutASignedInUserNothingIsLockedOrRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceThenAnswersBusy()
    {
        var retried = new Harness { Pending = "new.person@csps.test" };
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness { Pending = "new.person@csps.test" };
        busy.Unit.FailEverySaveWithConflict();
        (await busy.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken)).Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    private static UserAccount Account() =>
        new(TargetId, "person@csps.test", "Ana", "Abad", "Admin", IsActive: true, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Target = Account();
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<UserAccount?>(Target));
            Tokens = Substitute.For<IAccountTokens>();
            var directory = Substitute.For<IUserDirectory>();
            directory.GetProfileAsync(TargetId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProfileView?>(
                ProfileExists ? new ProfileView(TargetId, "Ana", "Abad", "person@csps.test", "Admin", Pending, Start.AddDays(-30), Guid.NewGuid()) : null));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new CancelUserEmailChangeHandler(Accounts, directory, Tokens, Audit, Unit, request, new FakeTimeProvider(Start));
        }

        public UserAccount? Target { get; set; }

        public string? Pending { get; set; }

        public bool ProfileExists { get; set; } = true;

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public CancelUserEmailChangeHandler Handler { get; }
    }
}
