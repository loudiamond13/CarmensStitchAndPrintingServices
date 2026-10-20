using System.Net;
using System.Text.RegularExpressions;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Domain.Time;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>
/// AUTH-13, D-20, D-24, D-25, D-29, D-30, D-31, D-32, D-45: all ten auth emails carry the UI-SPEC words, business time,
/// a safe link, encoded values and no remote resource, IP address or unfilled placeholder.
/// </summary>
public sealed class EmailRendererTests
{
    private const string BaseUrl = "https://carmens.example.com";
    private const string Token = "tok_abc-123";

    // 07:42 UTC is 3:42 PM at +08:00, the business zone offset.
    private static readonly DateTimeOffset At = new(2026, 10, 14, 7, 42, 0, TimeSpan.Zero);
    private static readonly DeviceDescription Chrome = new("Chrome on Android", true);

    public static TheoryData<AuthEmail> AllKinds() =>
    [
        new SignInCodeEmail("paolo.garcia@gmail.com", "048213", At.AddMinutes(15), At, Chrome),
        new AccountLockedEmail("paolo.garcia@gmail.com", At.AddMinutes(15), LockoutCause.Password, TimeSpan.FromMinutes(15)),
        new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, Chrome),
        new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: true),
        new ManagerResetEmail("paolo.garcia@gmail.com", "Carmen Reyes", At),
        new DeactivatedNoticeEmail("paolo.garcia@gmail.com"),
        new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At),
        new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com"),
        new EmailChangeNoticeEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", At, Chrome),
        new ManagerEmailChangedEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", "Carmen Reyes", At),
        new ManagerResetLinkEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, "Carmen Reyes"),
    ];

    [Theory]
    [InlineData(AuthEmailKind.AccountLocked, "Your CSPS account is locked for 15 minutes")]
    [InlineData(AuthEmailKind.PasswordReset, "Reset your CSPS password")]
    [InlineData(AuthEmailKind.PasswordChanged, "Your CSPS password was changed")]
    [InlineData(AuthEmailKind.ManagerReset, "A Manager reset your CSPS password")]
    [InlineData(AuthEmailKind.DeactivatedNotice, "Your CSPS password reset request")]
    [InlineData(AuthEmailKind.Invite, "Set up your CSPS staff account")]
    [InlineData(AuthEmailKind.EmailChangeConfirm, "Confirm your new CSPS email")]
    [InlineData(AuthEmailKind.EmailChangeNotice, "Your CSPS email is being changed")]
    [InlineData(AuthEmailKind.ManagerEmailChanged, "A Manager changed your CSPS sign-in email")]
    [InlineData(AuthEmailKind.ManagerResetLink, "Reset your CSPS password")]
    public async Task EachKindRendersItsUiSpecSubject(AuthEmailKind kind, string subject)
    {
        var email = AllKinds().Select(data => data.Data).Single(candidate => candidate.Kind == kind);

        (await RenderAsync(email)).Subject.ShouldBe(subject);
    }

    [Theory]
    [MemberData(nameof(AllKinds))]
    public async Task NoKindHasAPlaceholderARemoteResourceAnIpAddressOrAHeaderInjection(AuthEmail email)
    {
        var rendered = await RenderAsync(email);

        // The frame's one <style> block holds the phone-padding media query; braces are expected only there.
        var htmlWithoutStyle = Regex.Replace(rendered.Html, "<style>.*?</style>", string.Empty, RegexOptions.Singleline);
        foreach (var part in new[] { rendered.Subject, rendered.Text, htmlWithoutStyle })
        {
            part.ShouldNotContain("{");
            part.ShouldNotContain("}");
            Regex.IsMatch(part, @"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").ShouldBeFalse();
        }

        rendered.Subject.ShouldNotContain("\n");
        Regex.Matches(rendered.Html, "src=\"([^\"]*)\"").Select(match => match.Groups[1].Value).ShouldAllBe(source => source == "cid:csps-logo");
        Regex.Count(rendered.Html, @"<img\b").ShouldBeLessThanOrEqualTo(1);
        rendered.Html.ShouldNotContain("<script");
        rendered.Html.ShouldNotContain("<link");
        rendered.Html.ShouldNotContain("@import");
        rendered.Html.ShouldNotContain("url(");
        rendered.Html.ShouldNotContain("http://");
        rendered.Text.ShouldContain("Carmen's Stitch & Printing Services");
        rendered.Text.ShouldContain("Replies to this address aren't read.");
        rendered.Html.ShouldContain("Replies to this address aren&#39;t read.");
    }

    public static TheoryData<AuthEmail, string, string, string?, string?> UiSpecFrames() => new()
    {
        { new SignInCodeEmail("paolo.garcia@gmail.com", "048213", At.AddMinutes(15), At, Chrome), "Your sign-in code", "It works for 15 minutes. Never share it.", null, null },
        { new AccountLockedEmail("paolo.garcia@gmail.com", At.AddMinutes(15), LockoutCause.Password, TimeSpan.FromMinutes(15)), "Sign-in paused", "Sign-in is paused after too many wrong tries.", "Reset Password", $"{BaseUrl}/admin/forgot-password" },
        { new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, Chrome), "Reset your password", "This link works for 30 minutes.", "Reset Password", $"{BaseUrl}/admin/reset-password#token={Token}" },
        { new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: true), "Password changed", "If this wasn't you, act now.", "Reset Password", $"{BaseUrl}/admin/forgot-password" },
        { new ManagerResetEmail("paolo.garcia@gmail.com", "Carmen Reyes", At), "Your password was reset", "Ask them for your temporary password.", null, null },
        { new DeactivatedNoticeEmail("paolo.garcia@gmail.com"), "Account deactivated", "Your account is deactivated.", null, null },
        { new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At), "You're invited", "Choose your password to get started.", "Set Your Password", $"{BaseUrl}/admin/accept-invite#token={Token}" },
        { new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com"), "Confirm your new email", "This link works for 24 hours.", "Confirm Email", $"{BaseUrl}/admin/confirm-email#token={Token}" },
        { new EmailChangeNoticeEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", At, Chrome), "Email change requested", "If this wasn't you, act now.", "Reset Password", $"{BaseUrl}/admin/forgot-password" },
        { new ManagerEmailChangedEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", "Carmen Reyes", At), "Your sign-in email was changed", "Sign in with your new email from now on.", null, null },
        { new ManagerResetLinkEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, "Carmen Reyes"), "Reset your password", "This link works for 30 minutes.", "Reset Password", $"{BaseUrl}/admin/reset-password#token={Token}" },
    };

    [Theory]
    [MemberData(nameof(UiSpecFrames))]
    public async Task EveryKindIsInTheBrandedFrameWithItsHeadingPreheaderAndAtMostOneButton(
        AuthEmail email, string heading, string preheader, string? label, string? target)
    {
        var rendered = await RenderAsync(email);

        rendered.Html.ShouldContain("src=\"cid:csps-logo\"");
        rendered.Html.ShouldContain("#ff6600");
        rendered.Html.ShouldContain("max-width:600px");
        rendered.Html.ShouldContain($">{WebUtility.HtmlEncode(heading)}</h1>");
        rendered.Html.ShouldContain($">{WebUtility.HtmlEncode(preheader)}</div>");
        Regex.Count(rendered.Html, "bgcolor=\"#572e2b\"").ShouldBe(label is null ? 0 : 1);
        if (label is not null)
        {
            rendered.Html.ShouldContain($"href=\"{target}\"");
            rendered.Html.ShouldContain($"{label}</a>");
            rendered.Html.ShouldContain("If the button doesn&#39;t work, copy this link into your browser:");
            rendered.Text.ShouldContain($"{label}: {target}");
        }
    }

    [Theory]
    [InlineData(AuthEmailKind.PasswordReset)]
    [InlineData(AuthEmailKind.PasswordChanged)]
    [InlineData(AuthEmailKind.DeactivatedNotice)]
    [InlineData(AuthEmailKind.Invite)]
    [InlineData(AuthEmailKind.ManagerResetLink)]
    public async Task TheStaffAddressIsBoldInTheHtmlAndPlainInTheText(AuthEmailKind kind)
    {
        var email = AllKinds().Select(data => data.Data).Single(candidate => candidate.Kind == kind);

        var rendered = await RenderAsync(email);

        rendered.Html.ShouldContain("<strong style=\"font-weight:700\">paolo.garcia@gmail.com</strong>");
        CountOf(rendered.Html, "<strong").ShouldBe(1);
        rendered.Text.ShouldContain("paolo.garcia@gmail.com");
        rendered.Text.ShouldNotContain("<strong");
        rendered.Text.ShouldNotContain("**");
    }

    [Fact]
    public async Task TheBoldAddressIsStillHtmlEncoded()
    {
        var rendered = await RenderAsync(new DeactivatedNoticeEmail("a&b<x>@example.com"));

        rendered.Html.ShouldContain("<strong style=\"font-weight:700\">a&amp;b&lt;x&gt;@example.com</strong>");
        rendered.Html.ShouldNotContain("<x>");
    }

    [Theory]
    [InlineData(AuthEmailKind.SignInCode)]
    [InlineData(AuthEmailKind.AccountLocked)]
    [InlineData(AuthEmailKind.ManagerReset)]
    public async Task KindsThatDoNotShowTheAddressHaveNoBoldText(AuthEmailKind kind)
    {
        var email = AllKinds().Select(data => data.Data).Single(candidate => candidate.Kind == kind);

        (await RenderAsync(email)).Html.ShouldNotContain("<strong");
    }

    [Theory]
    [MemberData(nameof(AllKinds))]
    public async Task EverySentenceOfTheHtmlBodyIsInTheTextPart(AuthEmail email)
    {
        var rendered = await RenderAsync(email);
        var text = Normalise(rendered.Text);

        var withoutHead = Regex.Replace(rendered.Html, "<(style|title)>.*?</(style|title)>|<div style=\"display:none[^>]*>.*?</div>", string.Empty, RegexOptions.Singleline);
        var sentences = Regex.Split(withoutHead, "<[^>]+>")
            .Select(node => Normalise(WebUtility.HtmlDecode(node)))
            .Where(node => node.Length > 0)
            .ToList();

        sentences.Count.ShouldBeGreaterThan(3);
        foreach (var sentence in sentences.Where(node => !node.StartsWith("If the button doesn't work", StringComparison.Ordinal)))
        {
            text.ShouldContain(sentence);
        }
    }

    [Fact]
    public async Task ResetLinkIsBuiltFromTheBaseUrlWithTheTokenOnlyInTheFragmentAndOnlyInTheButtonAndItsFallback()
    {
        var rendered = await RenderAsync(new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, Chrome));
        var link = $"{BaseUrl}/admin/reset-password#token={Token}";

        rendered.Subject.ShouldNotContain(Token);
        CountOf(rendered.Text, Token).ShouldBe(1);
        rendered.Text.ShouldContain(link);
        CountOf(rendered.Html, Token).ShouldBe(2);
        rendered.Html.ShouldContain($"href=\"{link}\"");
        rendered.Html.ShouldContain("Reset Password</a>");
        rendered.Text.ShouldContain("We got a request to reset the password for paolo.garcia@gmail.com.");
        rendered.Text.ShouldContain("Requested Oct 14, 2026, 3:42 PM from Chrome on Android.");
        rendered.Text.ShouldContain("This link works for 30 minutes and only once.");
        rendered.Text.ShouldContain("Didn't ask for this? Ignore this email. Your password stays the same.");
        rendered.Html.ShouldContain("This link works for 30 minutes.");
    }

    [Fact]
    public async Task AnUnknownBrowserReadsAsAnUnknownBrowser()
    {
        var rendered = await RenderAsync(
            new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, new DeviceDescription("Unknown browser", false)));

        rendered.Text.ShouldContain("Requested Oct 14, 2026, 3:42 PM from an unknown browser.");
        rendered.Html.ShouldContain("from an unknown browser.");
    }

    [Fact]
    public async Task LockoutEmailLinksToTheForgotPasswordPageWithNoToken()
    {
        var password = await RenderAsync(new AccountLockedEmail("paolo.garcia@gmail.com", At.AddMinutes(15), LockoutCause.Password, TimeSpan.FromMinutes(15)));
        var code = await RenderAsync(new AccountLockedEmail("paolo.garcia@gmail.com", At.AddMinutes(15), LockoutCause.Code, TimeSpan.FromMinutes(15)));

        password.Text.ShouldContain($"{BaseUrl}/admin/forgot-password");
        password.Text.ShouldNotContain("#token");
        password.Html.ShouldContain($"href=\"{BaseUrl}/admin/forgot-password\"");
        password.Html.ShouldContain("Reset Password</a>");
        password.Html.ShouldContain("Sign-in paused");
        password.Text.ShouldContain(
            "There were too many wrong password tries on your account, so we paused sign-in for 15 minutes. You can sign in again after 3:57 PM on Oct 14, 2026.");
        code.Text.ShouldContain("There were too many wrong sign-in codes on your account");
        password.Text.ShouldContain("If this wasn't you, someone may be trying to get into your account. Reset your password.");
    }

    [Fact]
    public async Task DeactivatedNoticeSaysSoAndHasNoLink()
    {
        var rendered = await RenderAsync(new DeactivatedNoticeEmail("paolo.garcia@gmail.com"));

        rendered.Text.ShouldContain("Your account is deactivated. Ask a Manager if you need access.");
        rendered.Html.ShouldContain("Your account is deactivated. Ask a Manager if you need access.");
        rendered.Text.ShouldNotContain("http");
        rendered.Html.ShouldNotContain("<a ");
    }

    [Fact]
    public async Task PasswordChangedNoticeMentionsSessionsOnlyOnTheResetPath()
    {
        var reset = await RenderAsync(new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: true));
        var change = await RenderAsync(new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: false));

        const string Signed = "For your safety, every device signed in to your account was signed out.";
        reset.Text.ShouldContain("The password for paolo.garcia@gmail.com was changed on Oct 14, 2026, 3:42 PM.");
        reset.Text.ShouldContain(Signed);
        reset.Text.ShouldContain("If you did this, there's nothing else to do.");
        reset.Text.ShouldContain("If you didn't, reset your password now and tell a Manager.");
        reset.Text.ShouldContain($"{BaseUrl}/admin/forgot-password");
        change.Text.ShouldNotContain(Signed);
        change.Html.ShouldNotContain("every device");
    }

    [Fact]
    public async Task PasswordChangedFromMyProfileNamesOnlyTheOtherDevices()
    {
        var rendered = await RenderAsync(new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: true, OtherDevicesOnly: true));

        const string OtherDevices = "For your safety, every other device signed in to your account was signed out.";
        rendered.Text.ShouldContain("The password for paolo.garcia@gmail.com was changed on Oct 14, 2026, 3:42 PM.");
        rendered.Text.ShouldContain(OtherDevices);
        rendered.Html.ShouldContain(OtherDevices);
        rendered.Text.ShouldNotContain("every device signed in");
        rendered.Html.ShouldNotContain("every device signed in");
        rendered.Text.ShouldContain($"{BaseUrl}/admin/forgot-password");
        rendered.Html.ShouldContain($"href=\"{BaseUrl}/admin/forgot-password\"");
        rendered.Html.ShouldContain("Reset Password");
    }

    [Fact]
    public async Task TheOtherDevicesLineNeedsTheFlagAndDoesNotChangeTheOtherVariants()
    {
        var plain = await RenderAsync(new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: false));
        var reset = await RenderAsync(new PasswordChangedEmail("paolo.garcia@gmail.com", At, SessionsEnded: true));

        plain.Text.ShouldNotContain("every other device");
        reset.Text.ShouldNotContain("every other device");
        reset.Text.ShouldContain("For your safety, every device signed in to your account was signed out.");
    }

    [Fact]
    public async Task ManagerResetNamesTheManagerAndHasNoLink()
    {
        var rendered = await RenderAsync(new ManagerResetEmail("paolo.garcia@gmail.com", "Carmen Reyes", At));

        rendered.Text.ShouldContain("Carmen Reyes set a temporary password for your account on Oct 14, 2026, 3:42 PM. Ask them for it.");
        rendered.Text.ShouldContain("When you sign in with it, you'll choose your own password.");
        rendered.Text.ShouldContain("For your safety, every device signed in to your account was signed out.");
        rendered.Text.ShouldNotContain("http");
        rendered.Html.ShouldNotContain("<a ");
    }

    [Fact]
    public async Task AManagerResetLinkNamesTheManagerAndLinksToResetPasswordWithTheTokenInTheFragment()
    {
        var rendered = await RenderAsync(new ManagerResetLinkEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(30), At, "Carmen Reyes"));

        rendered.Subject.ShouldBe("Reset your CSPS password");
        rendered.Text.ShouldContain("Carmen Reyes sent you this link to set a new password for paolo.garcia@gmail.com.");
        rendered.Text.ShouldContain("This link works for 30 minutes and only once.");
        rendered.Text.ShouldContain("Didn't expect this? Ask Carmen Reyes or another Manager.");
        rendered.Text.ShouldContain($"Reset Password: {BaseUrl}/admin/reset-password#token={Token}");
        rendered.Html.ShouldContain($"href=\"{BaseUrl}/admin/reset-password#token={Token}\"");
        rendered.Html.ShouldContain("Reset Password</a>");
        rendered.Html.ShouldContain("Didn&#39;t expect this? Ask Carmen Reyes or another Manager.");
        rendered.Text.ShouldNotContain("Requested ");
    }

    [Fact]
    public async Task AManagerResetLinkEncodesTheManagerNameAndTheAddress()
    {
        var rendered = await RenderAsync(new ManagerResetLinkEmail("a&b@example.com", Token, At.AddMinutes(30), At, "<script>alert(1)</script>"));

        rendered.Html.ShouldNotContain("<script>");
        rendered.Html.ShouldContain("&lt;script&gt;alert(1)&lt;/script&gt; sent you this link");
        rendered.Html.ShouldContain("<strong style=\"font-weight:700\">a&amp;b@example.com</strong>");
    }

    [Fact]
    public async Task InviteLinksToAcceptInviteWithTheTokenInTheFragment()
    {
        var rendered = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At));

        rendered.Text.ShouldContain($"{BaseUrl}/admin/accept-invite#token={Token}");
        rendered.Html.ShouldContain($"href=\"{BaseUrl}/admin/accept-invite#token={Token}\"");
        rendered.Html.ShouldContain("Set Your Password</a>");
        rendered.Html.ShouldContain("You&#39;re invited");
        rendered.Text.ShouldContain("This link works for 7 days and only once. If it expires, ask a Manager to send a new invite.");
        rendered.Text.ShouldContain("Each time you sign in, we'll also email you a 6-digit code.");
        CountOf(rendered.Text, Token).ShouldBe(1);
    }

    [Fact]
    public async Task AnInviteFromAManagerOpensWithTheirNameAndEncodesItInTheHtml()
    {
        const string Line = "Carmen O'Reyes <Boss> set up your account.";

        var rendered = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At, InvitedBy: "Carmen O'Reyes <Boss>"));

        rendered.Text.ShouldContain(Line);
        rendered.Text.IndexOf(Line, StringComparison.Ordinal).ShouldBeLessThan(rendered.Text.IndexOf("A staff account at", StringComparison.Ordinal));
        rendered.Html.ShouldContain("Carmen O&#39;Reyes &lt;Boss&gt; set up your account.");
        rendered.Html.ShouldNotContain("<Boss>");
        rendered.Text.ShouldContain("This link works for 7 days and only once.");
    }

    [Fact]
    public async Task AnInviteWithoutAManagerKeepsTheBootstrapText()
    {
        var rendered = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At));

        rendered.Text.ShouldNotContain("set up your account.");
        rendered.Html.ShouldNotContain("set up your account.");
    }

    [Fact]
    public async Task LifetimesAreWordedFromTheRealExpiryNotFromFixedText()
    {
        var code = await RenderAsync(new SignInCodeEmail("paolo.garcia@gmail.com", "048213", At.AddMinutes(10), At, Chrome));
        var reset = await RenderAsync(new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddMinutes(45), At, Chrome));
        var invite = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddHours(24), At));
        var hour = await RenderAsync(new PasswordResetEmail("paolo.garcia@gmail.com", Token, At.AddHours(1), At, Chrome));
        var twoDays = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(2), At));
        var week = await RenderAsync(new InviteEmail("paolo.garcia@gmail.com", Token, At.AddDays(7), At));
        var locked = await RenderAsync(new AccountLockedEmail("paolo.garcia@gmail.com", At.AddMinutes(30), LockoutCause.Code, TimeSpan.FromMinutes(30)));

        code.Text.ShouldContain("It works for 10 minutes and only once.");
        code.Html.ShouldContain("It works for 10 minutes. Never share it.");
        reset.Text.ShouldContain("This link works for 45 minutes and only once.");
        reset.Html.ShouldContain("This link works for 45 minutes.");
        invite.Text.ShouldContain("This link works for 24 hours and only once.");
        hour.Text.ShouldContain("This link works for 1 hour and only once.");
        twoDays.Text.ShouldContain("This link works for 2 days and only once.");
        week.Text.ShouldContain("This link works for 7 days and only once.");
        locked.Subject.ShouldBe("Your CSPS account is locked for 30 minutes");
        locked.Text.ShouldContain("we paused sign-in for 30 minutes.");
        locked.Text.ShouldNotContain("15 minutes");
    }

    [Fact]
    public async Task TheConfirmEmailGoesToTheNewAddressWithTheContractWordsAndTheTokenOnlyInTheLink()
    {
        var rendered = await RenderAsync(new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com"));
        var link = $"{BaseUrl}/admin/confirm-email#token={Token}";

        rendered.Subject.ShouldBe("Confirm your new CSPS email");
        rendered.Text.ShouldContain("You asked to change the sign-in email for your CSPS staff account from paolo.garcia@gmail.com to paolo.new@gmail.com.");
        rendered.Text.ShouldContain("Open the link to confirm. It works for 24 hours and only once.");
        rendered.Text.ShouldContain("Didn't ask for this? Ignore this email. Nothing changes.");
        rendered.Text.ShouldContain($"Confirm Email: {link}");
        CountOf(rendered.Text, Token).ShouldBe(1);
        CountOf(rendered.Html, Token).ShouldBe(2);
        rendered.Subject.ShouldNotContain(Token);
        rendered.Html.ShouldContain($"href=\"{link}\"");
    }

    [Fact]
    public async Task AManagerStartedConfirmEmailNamesTheManagerInsteadOfTheSelfSentence()
    {
        var rendered = await RenderAsync(
            new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com", ChangedBy: "Carmen Reyes"));

        rendered.Subject.ShouldBe("Confirm your new CSPS email");
        rendered.Text.ShouldContain("Carmen Reyes changed the sign-in email for your CSPS staff account to paolo.new@gmail.com.");
        rendered.Text.ShouldNotContain("You asked to change");
        rendered.Html.ShouldContain("<strong style=\"font-weight:700\">paolo.new@gmail.com</strong>");
        rendered.Text.ShouldContain("Open the link to confirm. It works for 24 hours and only once.");
        rendered.Text.ShouldContain($"Confirm Email: {BaseUrl}/admin/confirm-email#token={Token}");
        CountOf(rendered.Text, Token).ShouldBe(1);
    }

    [Fact]
    public async Task TheManagerNameIsHtmlEncodedAndABlankOneFallsBackToTheSelfSentence()
    {
        var encoded = await RenderAsync(
            new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com", ChangedBy: "Carmen <Boss> & Co"));
        var blank = await RenderAsync(
            new EmailChangeConfirmEmail("paolo.new@gmail.com", Token, At.AddHours(24), At, "paolo.garcia@gmail.com", ChangedBy: "  "));

        encoded.Html.ShouldContain("Carmen &lt;Boss&gt; &amp; Co changed the sign-in email");
        encoded.Html.ShouldNotContain("<Boss>");
        blank.Text.ShouldContain("You asked to change the sign-in email for your CSPS staff account from paolo.garcia@gmail.com to paolo.new@gmail.com.");
    }

    [Fact]
    public async Task TheManagerChangedNoticeGoesToTheOldAddressWithTheTimeTheSignedOutLineAndNoLinkOrToken()
    {
        var rendered = await RenderAsync(new ManagerEmailChangedEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", "Carmen Reyes", At));

        rendered.Subject.ShouldBe("A Manager changed your CSPS sign-in email");
        rendered.Text.ShouldContain("Carmen Reyes changed your sign-in email to paolo.new@gmail.com.");
        rendered.Text.ShouldContain("Changed Oct 14, 2026, 3:42 PM.");
        rendered.Text.ShouldContain("From now on, sign in with paolo.new@gmail.com. This address, paolo.garcia@gmail.com, no longer signs in to CSPS.");
        rendered.Text.ShouldContain("For your safety, every device signed in to your account was signed out.");
        rendered.Text.ShouldContain("If you didn't expect this, tell a Manager.");
        rendered.Text.ShouldNotContain("http");
        rendered.Html.ShouldNotContain("<a ");
        rendered.Html.ShouldContain("<strong style=\"font-weight:700\">paolo.new@gmail.com</strong>");
    }

    [Fact]
    public async Task TheManagerChangedNoticeEncodesTheManagerNameAndBothAddresses()
    {
        var rendered = await RenderAsync(new ManagerEmailChangedEmail("old&y<i>@example.com", "new&x<b>@example.com", "Carmen <Boss>", At));

        rendered.Html.ShouldContain("Carmen &lt;Boss&gt; changed your sign-in email to");
        rendered.Html.ShouldContain("new&amp;x&lt;b&gt;@example.com");
        rendered.Html.ShouldContain("old&amp;y&lt;i&gt;@example.com");
        rendered.Html.ShouldNotContain("<Boss>");
        rendered.Html.ShouldNotContain("<b>");
        rendered.Html.ShouldNotContain("<i>");
        rendered.Text.ShouldContain("Carmen <Boss> changed your sign-in email to new&x<b>@example.com.");
    }

    [Fact]
    public async Task TheNoticeGoesToTheOldAddressWithTheManilaTimeTheDeviceAndNoToken()
    {
        var rendered = await RenderAsync(new EmailChangeNoticeEmail("paolo.garcia@gmail.com", "paolo.new@gmail.com", At, Chrome));

        rendered.Subject.ShouldBe("Your CSPS email is being changed");
        rendered.Text.ShouldContain("Someone asked to change the sign-in email for your CSPS staff account to paolo.new@gmail.com.");
        rendered.Text.ShouldContain("Requested Oct 14, 2026, 3:42 PM from Chrome on Android.");
        rendered.Text.ShouldContain("The change happens only after the new address is confirmed. Until then, you still sign in with paolo.garcia@gmail.com.");
        rendered.Text.ShouldContain("If this wasn't you, change your password now and tell a Manager.");
        rendered.Text.ShouldContain($"Reset Password: {BaseUrl}/admin/forgot-password");
        rendered.Text.ShouldNotContain("#token");
        rendered.Html.ShouldNotContain("#token");
        rendered.Text.ShouldNotContain("confirm-email");
    }

    [Fact]
    public async Task BothEmailChangeAddressesAreHtmlEncodedAndPlainInTheText()
    {
        var confirm = await RenderAsync(new EmailChangeConfirmEmail("new&x<b>@example.com", Token, At.AddHours(24), At, "old&y<i>@example.com"));
        var notice = await RenderAsync(new EmailChangeNoticeEmail("old&y<i>@example.com", "new&x<b>@example.com", At, Chrome));

        foreach (var rendered in new[] { confirm, notice })
        {
            rendered.Html.ShouldContain("new&amp;x&lt;b&gt;@example.com");
            rendered.Html.ShouldNotContain("<b>");
            rendered.Html.ShouldNotContain("<i>");
            rendered.Text.ShouldContain("new&x<b>@example.com");
        }

        confirm.Html.ShouldContain("old&amp;y&lt;i&gt;@example.com");
        notice.Html.ShouldContain("old&amp;y&lt;i&gt;@example.com");
    }

    [Fact]
    public async Task ValuesAreEncodedInHtmlAndPlainInText()
    {
        var rendered = await RenderAsync(new ManagerResetEmail("a&b@example.com", "<script>alert(1)</script>", At));

        rendered.Html.ShouldNotContain("<script>");
        rendered.Html.ShouldContain("&lt;script&gt;alert(1)&lt;/script&gt; set a temporary password");
        rendered.Text.ShouldContain("<script>alert(1)</script> set a temporary password");
    }

    [Fact]
    public async Task OnlyTheSignInCodeEmailCarriesTheCodeAndOnlyInTheSubjectAndTheCodeBlock()
    {
        var rendered = await RenderAsync(new SignInCodeEmail("paolo.garcia@gmail.com", "048213", At.AddMinutes(15), At, Chrome));

        rendered.Subject.ShouldBe("048213 is your CSPS sign-in code");
        CountOf(rendered.Html, "048213").ShouldBe(2);
        CountOf(rendered.Text, "048213").ShouldBe(1);
    }

    [Fact]
    public async Task AKindWithoutATemplateIsRefused()
    {
        await Should.ThrowAsync<NotSupportedException>(() => RenderAsync(new UnknownEmail("paolo.garcia@gmail.com")));
    }

    private static string Normalise(string value) => Regex.Replace(value, @"\s+", " ").Trim();

    private static int CountOf(string value, string part) => Regex.Count(value, Regex.Escape(part));

    private static async Task<RenderedEmail> RenderAsync(AuthEmail email)
    {
        var links = Options.Create(new AppLinksOptions { PublicBaseUrl = BaseUrl });
        var renderer = new EmailRenderer(new FixedCalendar(), links);
        return await renderer.RenderAsync(email, TestContext.Current.CancellationToken);
    }

    private sealed record UnknownEmail(string To) : AuthEmail(To)
    {
        public override AuthEmailKind Kind => (AuthEmailKind)99;

        public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => createdAt;
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var zone = TimeZoneInfo.CreateCustomTimeZone("business", TimeSpan.FromHours(8), "business", "business");
            return ValueTask.FromResult(new BusinessClock(zone, ZoneSource.Stored, At));
        }
    }
}
