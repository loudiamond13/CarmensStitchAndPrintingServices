using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

public sealed class UserSessionTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid UserId = new("6f9619ff-8b86-d011-b42d-00cf4fc964ff");

    private static readonly SessionSettings Settings = SessionSettings.Default;

    private static byte[] Hash(string secret) => TokenHash.Compute(secret);

    private static (UserSession Session, RefreshToken Token) NewSession(bool persistent = true) =>
        UserSession.Start(UserId, persistent, "Chrome on Android", Hash("first"), T0, Settings);

    [Fact]
    public void StartPersistentLivesNinetyDaysAndTheCookieEndsWithIt()
    {
        var (session, token) = NewSession();

        session.Id.Version.ShouldBe(7);
        session.UserId.ShouldBe(UserId);
        session.Persistent.ShouldBeTrue();
        session.CreatedAt.ShouldBe(T0);
        session.LastActiveAt.ShouldBe(T0);
        session.AbsoluteExpiresAt.ShouldBe(T0.AddDays(90));
        session.CookieExpiresAt.ShouldBe(T0.AddDays(90));
        session.DeviceLabel.ShouldBe("Chrome on Android");
        session.RevokedAt.ShouldBeNull();
        session.RevokedReason.ShouldBeNull();
        token.SessionId.ShouldBe(session.Id);
        token.ParentId.ShouldBeNull();
        token.TokenHash.ShouldBe(Hash("first"));
        token.IssuedAt.ShouldBe(T0);
        token.ConsumedAt.ShouldBeNull();
        token.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public void StartForABrowserSessionLivesTwelveHoursWithNoCookieExpiry()
    {
        var (session, _) = NewSession(persistent: false);

        session.Persistent.ShouldBeFalse();
        session.AbsoluteExpiresAt.ShouldBe(T0.AddHours(12));
        session.CookieExpiresAt.ShouldBeNull();
    }

    [Fact]
    public void StartTruncatesALongDeviceLabelToSixtyCharacters()
    {
        var (session, _) = UserSession.Start(UserId, true, new string('x', 80), Hash("first"), T0, Settings);

        UserSession.DeviceLabelMaxLength.ShouldBe(60);
        session.DeviceLabel.ShouldBe(new string('x', 60));
    }

    [Fact]
    public void StartKeepsALabelOfExactlySixtyCharacters()
    {
        var label = new string('y', 60);

        var (session, _) = UserSession.Start(UserId, true, label, Hash("first"), T0, Settings);

        session.DeviceLabel.ShouldBe(label);
    }

    [Fact]
    public void StartRejectsAHashThatIsNot32Bytes()
    {
        Should.Throw<ArgumentException>(() => UserSession.Start(UserId, true, "x", new byte[31], T0, Settings));
    }

    [Fact]
    public void RotateALiveTokenConsumesItAndHandsBackAChild()
    {
        var (session, first) = NewSession();
        var now = T0.AddMinutes(10);

        var result = session.Rotate(first, [first], Hash("second"), now, Settings);

        result.Outcome.ShouldBe(RotationOutcome.Rotated);
        result.NewToken.ShouldNotBeNull();
        result.NewToken.ParentId.ShouldBe(first.Id);
        result.NewToken.SessionId.ShouldBe(session.Id);
        result.NewToken.TokenHash.ShouldBe(Hash("second"));
        result.NewToken.IssuedAt.ShouldBe(now);
        first.ConsumedAt.ShouldBe(now);
        session.LastActiveAt.ShouldBe(now);
    }

    [Fact]
    public void RotationNeverExtendsTheFixedLifetime()
    {
        var (session, first) = NewSession();
        var expires = session.AbsoluteExpiresAt;

        var second = session.Rotate(first, [first], Hash("second"), T0.AddDays(30), Settings).NewToken!;
        session.Rotate(second, [first, second], Hash("third"), T0.AddDays(60), Settings);

        session.AbsoluteExpiresAt.ShouldBe(expires);
        session.CookieExpiresAt.ShouldBe(expires);
    }

    [Fact]
    public void RotateRejectsAHashThatIsNot32Bytes()
    {
        var (session, first) = NewSession();

        Should.Throw<ArgumentException>(() => session.Rotate(first, [first], new byte[5], T0.AddMinutes(1), Settings));
    }

    [Fact]
    public void RotateRejectsATokenFromAnotherSession()
    {
        var (session, _) = NewSession();
        var (_, foreign) = NewSession();

        Should.Throw<ArgumentException>(() => session.Rotate(foreign, [foreign], Hash("x"), T0.AddMinutes(1), Settings));
    }
}
