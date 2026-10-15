using Csps.Application.Email;
using Csps.Domain.Identity;

namespace Csps.Application.UnitTests.Email;

/// <summary>AUTH-13: the seven auth email kinds, when each stops being worth sending, and that a secret never prints.</summary>
public sealed class AuthEmailTests
{
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset ExpiresAt = CreatedAt.AddMinutes(15);
    private static readonly DeviceDescription Device = new("Chrome on Android", true);

    [Fact]
    public void EachRecordReportsItsKind()
    {
        Kinds().Select(email => email.Kind).ShouldBe(
        [
            AuthEmailKind.SignInCode,
            AuthEmailKind.AccountLocked,
            AuthEmailKind.PasswordReset,
            AuthEmailKind.PasswordChanged,
            AuthEmailKind.ManagerReset,
            AuthEmailKind.DeactivatedNotice,
            AuthEmailKind.Invite,
        ]);
    }

    [Fact]
    public void CodeResetAndInviteEmailsExpireWithTheirCodeOrLink()
    {
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
        new PasswordResetEmail("a@example.com", "token", ExpiresAt, CreatedAt, Device).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
        new InviteEmail("a@example.com", "token", ExpiresAt, CreatedAt).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
    }

    [Fact]
    public void OtherEmailsAreWorthSendingForADay()
    {
        var expected = CreatedAt.AddDays(1);

        new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Password, TimeSpan.FromMinutes(15)).NotAfter(CreatedAt).ShouldBe(expected);
        new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: true).NotAfter(CreatedAt).ShouldBe(expected);
        new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt).NotAfter(CreatedAt).ShouldBe(expected);
        new DeactivatedNoticeEmail("a@example.com").NotAfter(CreatedAt).ShouldBe(expected);
    }

    [Fact]
    public void RecordsThatCarryASecretPrintOnlyTheirKind()
    {
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device).ToString()
            .ShouldBe("SignInCodeEmail");
        new PasswordResetEmail("a@example.com", "reset-token-value", ExpiresAt, CreatedAt, Device).ToString()
            .ShouldBe("PasswordResetEmail");
        new InviteEmail("a@example.com", "invite-token-value", ExpiresAt, CreatedAt).ToString()
            .ShouldBe("InviteEmail");
    }

    [Fact]
    public void RecordsCarryTheirValues()
    {
        var locked = new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Code, TimeSpan.FromMinutes(15));
        locked.To.ShouldBe("a@example.com");
        locked.LockedUntil.ShouldBe(ExpiresAt);
        locked.Cause.ShouldBe(LockoutCause.Code);
        locked.LockedFor.ShouldBe(TimeSpan.FromMinutes(15));

        var changed = new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: false);
        changed.ChangedAt.ShouldBe(CreatedAt);
        changed.SessionsEnded.ShouldBeFalse();

        var reset = new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt);
        reset.ManagerName.ShouldBe("Carmen Reyes");
        reset.ResetAt.ShouldBe(CreatedAt);

        var code = new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device);
        code.Code.ShouldBe("048213");
        code.ExpiresAt.ShouldBe(ExpiresAt);
        code.RequestedAt.ShouldBe(CreatedAt);
        code.Device.ShouldBe(Device);

        new PasswordResetEmail("a@example.com", "t", ExpiresAt, CreatedAt, Device).Token.ShouldBe("t");
        new InviteEmail("a@example.com", "t", ExpiresAt, CreatedAt).Token.ShouldBe("t");
    }

    private static AuthEmail[] Kinds() =>
    [
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device),
        new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Password, TimeSpan.FromMinutes(15)),
        new PasswordResetEmail("a@example.com", "token", ExpiresAt, CreatedAt, Device),
        new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: true),
        new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt),
        new DeactivatedNoticeEmail("a@example.com"),
        new InviteEmail("a@example.com", "token", ExpiresAt, CreatedAt),
    ];
}
