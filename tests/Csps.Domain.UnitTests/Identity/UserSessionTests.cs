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

    // A session whose first token A was rotated to B one minute in; `all` is what the store would load.
    private static (UserSession Session, List<RefreshToken> All, RefreshToken A, RefreshToken B, DateTimeOffset T) Rotated()
    {
        var (session, a) = NewSession();
        var t = T0.AddMinutes(1);
        var b = session.Rotate(a, [a], Hash("b"), t, Settings).NewToken!;
        return (session, [a, b], a, b, t);
    }

    private static RefreshToken Present(
        UserSession session, List<RefreshToken> all, RefreshToken token, string hash, DateTimeOffset now)
    {
        var result = session.Rotate(token, all, Hash(hash), now, Settings);
        result.NewToken.ShouldNotBeNull();
        all.Add(result.NewToken);
        return result.NewToken;
    }

    [Fact]
    public void ARotatedTokenPresentedAgainAtThirtySecondsGetsASibling()
    {
        var (session, all, a, _, t) = Rotated();
        var now = t.AddSeconds(30);

        var result = session.Rotate(a, all, Hash("c"), now, Settings);

        result.Outcome.ShouldBe(RotationOutcome.GraceSibling);
        result.NewToken.ShouldNotBeNull();
        result.NewToken.ParentId.ShouldBe(a.Id);
        result.NewToken.IssuedAt.ShouldBe(now);
        a.ConsumedAt.ShouldBe(t);
        session.LastActiveAt.ShouldBe(now);
        session.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public void ARotatedTokenPresentedAgainAtThirtyOneSecondsIsReuseAndEndsTheSession()
    {
        var (session, all, a, b, t) = Rotated();
        var now = t.AddSeconds(31);

        var result = session.Rotate(a, all, Hash("c"), now, Settings);

        result.Outcome.ShouldBe(RotationOutcome.ReuseDetected);
        result.NewToken.ShouldBeNull();
        session.RevokedAt.ShouldBe(now);
        session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
        b.RevokedAt.ShouldBe(now);
    }

    [Fact]
    public void TheFifthSiblingIsStillFineAndTheSixthIsReuse()
    {
        var (session, all, a, _, t) = Rotated();

        for (var i = 1; i <= 5; i++)
        {
            Present(session, all, a, $"s{i}", t.AddSeconds(i));
        }

        var sixth = session.Rotate(a, all, Hash("s6"), t.AddSeconds(6), Settings);

        sixth.Outcome.ShouldBe(RotationOutcome.ReuseDetected);
        session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
    }

    [Fact]
    public void ASiblingOlderThanThirtySecondsIsRevokedWhenAnotherTokenRotates()
    {
        var (session, all, a, b, t) = Rotated();
        var c = Present(session, all, a, "c", t.AddSeconds(10));
        var d = Present(session, all, a, "d", t.AddSeconds(25));
        var now = t.AddSeconds(41);

        var result = session.Rotate(b, all, Hash("e"), now, Settings);

        result.Outcome.ShouldBe(RotationOutcome.Rotated);
        c.RevokedAt.ShouldBe(now);
        d.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public void ASiblingExactlyThirtySecondsOldIsKept()
    {
        var (session, all, a, b, t) = Rotated();
        var c = Present(session, all, a, "c", t.AddSeconds(10));

        session.Rotate(b, all, Hash("e"), t.AddSeconds(40), Settings);

        c.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public void ARevokedTokenPresentedLaterIsReuseAndEndsTheSession()
    {
        var (session, all, a, b, t) = Rotated();
        var c = Present(session, all, a, "c", t.AddSeconds(10));
        var d = Present(session, all, b, "d", t.AddSeconds(60));
        c.RevokedAt.ShouldNotBeNull();
        var now = t.AddSeconds(61);

        var result = session.Rotate(c, all, Hash("e"), now, Settings);

        result.Outcome.ShouldBe(RotationOutcome.ReuseDetected);
        result.NewToken.ShouldBeNull();
        session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
        d.RevokedAt.ShouldBe(now);
    }

    [Fact]
    public void ARevokedSiblingKeepsItsFirstRevocationTime()
    {
        var (session, all, a, b, t) = Rotated();
        var c = Present(session, all, a, "c", t.AddSeconds(10));
        var d = Present(session, all, b, "d", t.AddSeconds(60));
        var revokedAt = c.RevokedAt;

        Present(session, all, d, "e", t.AddSeconds(120));

        c.RevokedAt.ShouldBe(revokedAt);
    }
}
