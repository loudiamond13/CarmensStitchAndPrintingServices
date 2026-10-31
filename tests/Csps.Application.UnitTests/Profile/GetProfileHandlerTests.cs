using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Profile;
using NSubstitute;

namespace Csps.Application.UnitTests.Profile;

/// <summary>PROF-01, CWE-639: the profile read maps every field and only ever reads the token's own account.</summary>
public sealed class GetProfileHandlerTests
{
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");
    private static readonly Guid Version = Guid.Parse("9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72");
    private static readonly DateTimeOffset Since = new(2026, 3, 9, 1, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task AKnownUserMapsEveryField()
    {
        var view = new ProfileView(UserId, "Paolo", "Reyes", "staff@example.test", "Manager", "new@example.test", Since, Version);

        var result = await Handler(UserId, view).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new ProfileResponse(UserId, "Paolo", "Reyes", "staff@example.test", "Manager", "new@example.test", Since, Version));
    }

    [Fact]
    public async Task ANullPendingEmailStaysNull()
    {
        var view = new ProfileView(UserId, "Paolo", "Reyes", "staff@example.test", "Admin", null, Since, Version);

        var result = await Handler(UserId, view).HandleAsync(TestContext.Current.CancellationToken);

        result.Value.PendingEmail.ShouldBeNull();
    }

    [Fact]
    public async Task NoUserInTheRequestIsASessionEndedAndReadsNothing()
    {
        var directory = Substitute.For<IUserDirectory>();
        var handler = new GetProfileHandler(directory, Request(null));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await directory.DidNotReceiveWithAnyArgs().GetProfileAsync(Guid.Empty, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task AnUnknownIdIsASessionEnded()
    {
        var result = await Handler(UserId, null).HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    [Fact]
    public async Task OnlyTheTokensOwnIdIsRead()
    {
        var directory = Substitute.For<IUserDirectory>();
        var handler = new GetProfileHandler(directory, Request(UserId));

        await handler.HandleAsync(TestContext.Current.CancellationToken);

        await directory.Received(1).GetProfileAsync(UserId, Arg.Any<CancellationToken>());
        await directory.ReceivedWithAnyArgs(1).GetProfileAsync(Guid.Empty, TestContext.Current.CancellationToken);
    }

    private static GetProfileHandler Handler(Guid userId, ProfileView? view)
    {
        var directory = Substitute.For<IUserDirectory>();
        directory.GetProfileAsync(userId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(view));
        return new GetProfileHandler(directory, Request(userId));
    }

    private static IRequestContext Request(Guid? userId)
    {
        var request = Substitute.For<IRequestContext>();
        request.UserId.Returns(userId);
        return request;
    }
}
