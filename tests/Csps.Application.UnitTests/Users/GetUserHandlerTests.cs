using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Common;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>USER-01, SEC-08, D-09, D-11: the detail maps every field, and a missing or deleted person is one 404.</summary>
public sealed class GetUserHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");
    private static readonly Guid Version = Guid.Parse("9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72");
    private static readonly ActorRef Recorder = new(Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10"), "Cora Creator", true);
    private static readonly ActorRef Editor = new(Guid.Parse("7e3a5b19-6d24-4c8f-b0a7-1f9d2c4e6a38"), "Edna Editor", false);

    [Fact]
    public async Task AFoundPersonMapsEveryField()
    {
        var view = new UserDetailView(
            UserId, "Tess", "Target", "tess@example.test", "Admin", UserStatuses.Locked, InviteStates.Pending,
            Start.AddDays(-30), false, true, "new@example.test", Start.AddDays(-1), Version, Recorder, Editor);
        var harness = new Harness(view);

        var result = await harness.Handler.HandleAsync(UserId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new UserDetailResponse(
            UserId, "Tess", "Target", "tess@example.test", "Admin", "locked", "pending",
            Start.AddDays(-30), false, true, "new@example.test", Start.AddDays(-1), Version, Recorder, Editor));
        await harness.Directory.Received(1).GetUserAsync(UserId, Start, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ASystemMadeUntouchedAccountKeepsNullActorsAndNullDates()
    {
        var view = new UserDetailView(
            UserId, "Tess", "Target", "tess@example.test", "Manager", UserStatuses.Active, InviteStates.None,
            Start, true, false, null, null, Version, null, null);
        var harness = new Harness(view);

        var result = await harness.Handler.HandleAsync(UserId, TestContext.Current.CancellationToken);

        result.Value.RecordedBy.ShouldBeNull();
        result.Value.LastChangedBy.ShouldBeNull();
        result.Value.UpdatedAt.ShouldBeNull();
        result.Value.PendingEmail.ShouldBeNull();
    }

    [Fact]
    public async Task AFormerStaffActorKeepsTheNameAndTheFlag()
    {
        var view = new UserDetailView(
            UserId, "Tess", "Target", "tess@example.test", "Manager", UserStatuses.Active, InviteStates.None,
            Start, true, false, null, null, Version, Recorder, Recorder);
        var harness = new Harness(view);

        var result = await harness.Handler.HandleAsync(UserId, TestContext.Current.CancellationToken);

        result.Value.RecordedBy.ShouldBe(new ActorRef(Recorder.Id, "Cora Creator", true));
        result.Value.LastChangedBy.ShouldBe(result.Value.RecordedBy);
    }

    [Fact]
    public async Task ADeletedOrUnknownPersonIsTheOneNotFoundAnswer()
    {
        var harness = new Harness(null);

        var result = await harness.Handler.HandleAsync(UserId, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(UserErrors.NotFound);
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("users.not-found");
        result.Error.Message.ShouldBe("This user was deleted.");
    }

    [Fact]
    public void ANullViewCannotBeMapped()
    {
        Should.Throw<ArgumentNullException>(() => UserDetailResponse.From(null!));
    }

    private sealed class Harness
    {
        public Harness(UserDetailView? view)
        {
            Directory = Substitute.For<IUserDirectory>();
            Directory.GetUserAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(view));
            Handler = new GetUserHandler(Directory, new FakeTimeProvider(Start));
        }

        public IUserDirectory Directory { get; }

        public GetUserHandler Handler { get; }
    }
}
