using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

/// <summary>AUTH-08, D-28: a link token is hashed, short-lived, single-use and revocable.</summary>
public sealed class AccountTokenTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = new("6f9619ff-8b86-d011-b42d-00cf4fc964ff");
    private static readonly TimeSpan ThirtyMinutes = TimeSpan.FromMinutes(30);

    private static AccountToken NewToken() =>
        AccountToken.Create(UserId, AccountTokenPurpose.PasswordReset, TokenHash.Compute("token"), T0, ThirtyMinutes);

    [Fact]
    public void PurposesAreStoredAsSmallNumbers()
    {
        ((byte)AccountTokenPurpose.PasswordReset).ShouldBe((byte)1);
        ((byte)AccountTokenPurpose.Invitation).ShouldBe((byte)2);
    }

    [Fact]
    public void CreateKeepsTheHashAndSetsTheLifetime()
    {
        var token = NewToken();

        token.UserId.ShouldBe(UserId);
        token.Purpose.ShouldBe(AccountTokenPurpose.PasswordReset);
        token.TokenHash.ShouldBe(TokenHash.Compute("token"));
        token.CreatedAt.ShouldBe(T0);
        token.ExpiresAt.ShouldBe(T0.AddMinutes(30));
        token.UsedAt.ShouldBeNull();
        token.RevokedAt.ShouldBeNull();
        token.Id.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    public void ItIsUsableUntilTheThirtiethMinute()
    {
        var token = NewToken();

        token.IsUsable(T0).ShouldBeTrue();
        token.IsUsable(T0.AddMinutes(29).AddSeconds(59)).ShouldBeTrue();
        token.IsUsable(T0.AddMinutes(30)).ShouldBeFalse();
        token.IsUsable(T0.AddHours(2)).ShouldBeFalse();
    }

    [Fact]
    public void UseMakesItUnusableAndASecondUseThrows()
    {
        var token = NewToken();

        token.Use(T0.AddMinutes(1));

        token.UsedAt.ShouldBe(T0.AddMinutes(1));
        token.IsUsable(T0.AddMinutes(2)).ShouldBeFalse();
        Should.Throw<InvalidOperationException>(() => token.Use(T0.AddMinutes(3)));
    }

    [Fact]
    public void UseAfterTheExpiryThrows()
    {
        var token = NewToken();

        Should.Throw<InvalidOperationException>(() => token.Use(T0.AddMinutes(30)));
        token.UsedAt.ShouldBeNull();
    }

    [Fact]
    public void RevokeMakesItUnusableAndThrowsOnUse()
    {
        var token = NewToken();

        token.Revoke(T0.AddMinutes(1));

        token.RevokedAt.ShouldBe(T0.AddMinutes(1));
        token.IsUsable(T0.AddMinutes(2)).ShouldBeFalse();
        Should.Throw<InvalidOperationException>(() => token.Use(T0.AddMinutes(2)));
    }

    [Fact]
    public void RevokeKeepsTheFirstRevocationTime()
    {
        var token = NewToken();
        token.Revoke(T0.AddMinutes(1));

        token.Revoke(T0.AddMinutes(5));

        token.RevokedAt.ShouldBe(T0.AddMinutes(1));
    }

    [Fact]
    public void RevokeLeavesAUsedTokenAsItWas()
    {
        var token = NewToken();
        token.Use(T0.AddMinutes(1));

        token.Revoke(T0.AddMinutes(2));

        token.RevokedAt.ShouldBeNull();
        token.UsedAt.ShouldBe(T0.AddMinutes(1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    [InlineData(33)]
    public void AHashThatIsNot32BytesIsRejected(int length)
    {
        Should.Throw<ArgumentException>(
            () => AccountToken.Create(UserId, AccountTokenPurpose.PasswordReset, new byte[length], T0, ThirtyMinutes));
    }

    [Fact]
    public void AnUnknownPurposeIsRejected()
    {
        Should.Throw<ArgumentOutOfRangeException>(
            () => AccountToken.Create(UserId, (AccountTokenPurpose)0, TokenHash.Compute("token"), T0, ThirtyMinutes));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ALifetimeThatIsNotPositiveIsRejected(int minutes)
    {
        Should.Throw<ArgumentOutOfRangeException>(
            () => AccountToken.Create(UserId, AccountTokenPurpose.PasswordReset, TokenHash.Compute("token"), T0, TimeSpan.FromMinutes(minutes)));
    }
}
