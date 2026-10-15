using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>The state a test staff account starts in.</summary>
public enum StaffState
{
    /// <summary>Active, confirmed, with a password.</summary>
    Active,

    /// <summary>Deactivated, with a password.</summary>
    Deactivated,

    /// <summary>Active with a password, but the email is not confirmed.</summary>
    Unconfirmed,

    /// <summary>Active and invited, with no password yet.</summary>
    NoPassword,
}

/// <summary>A test staff account and the password it was created with.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Password">The password.</param>
internal sealed record TestStaff(Guid Id, string Email, string Password);

/// <summary>A device that finished sign-in: the access token, the refresh cookie value and the session's fixed end.</summary>
/// <param name="UserId">The account id.</param>
/// <param name="SessionId">The session id (the token's <c>sid</c>).</param>
/// <param name="AccessToken">The 15-minute bearer token.</param>
/// <param name="RefreshToken">The refresh cookie value.</param>
/// <param name="CookieExpires">The refresh cookie's expiry; null for a browser-session cookie.</param>
/// <param name="SessionExpiresAt">The session's fixed end.</param>
internal sealed record SignedInDevice(
    Guid UserId, Guid SessionId, string AccessToken, string RefreshToken, DateTimeOffset? CookieExpires, DateTimeOffset SessionExpiresAt);

/// <summary>One row of the signed-in devices list.</summary>
/// <param name="Id">The session id.</param>
/// <param name="Device">The coarse device label.</param>
/// <param name="SignedInAt">When the device signed in.</param>
/// <param name="LastActiveAt">The device's last activity.</param>
/// <param name="Persistent">True for "Keep me signed in".</param>
/// <param name="Current">True for the caller's own device.</param>
internal sealed record ListedSession(Guid Id, string Device, DateTimeOffset SignedInAt, DateTimeOffset LastActiveAt, bool Persistent, bool Current);

/// <summary>A message read from the Testing email sink.</summary>
/// <param name="Id">The sink cursor id.</param>
/// <param name="To">The recipient.</param>
/// <param name="Subject">The subject.</param>
/// <param name="Text">The text part.</param>
/// <param name="Html">The HTML part.</param>
internal sealed record SinkEmail(long Id, string To, string Subject, string Text, string Html);

/// <summary>
/// Helpers for the auth integration tests: https clients with cookies, staff accounts in a chosen state, sign-in
/// calls and the Testing email sink (D-27). Nothing here sends real mail.
/// </summary>
internal static partial class AuthClient
{
    /// <summary>The sign-in route.</summary>
    public const string SignInRoute = "/api/v1/auth/sign-in";

    /// <summary>The code verification route.</summary>
    public const string VerifyRoute = "/api/v1/auth/two-factor/verify";

    /// <summary>The code resend route.</summary>
    public const string ResendRoute = "/api/v1/auth/two-factor/resend";

    /// <summary>The refresh route.</summary>
    public const string RefreshRoute = "/api/v1/auth/refresh";

    /// <summary>The sign-out route.</summary>
    public const string SignOutRoute = "/api/v1/auth/sign-out";

    /// <summary>The sign-out-other-devices route.</summary>
    public const string SignOutOthersRoute = "/api/v1/auth/sign-out-others";

    /// <summary>The signed-in devices route.</summary>
    public const string SessionsRoute = "/api/v1/sessions";

    /// <summary>The forgot-password route.</summary>
    public const string ForgotRoute = "/api/v1/auth/password/forgot";

    /// <summary>The reset-link check route.</summary>
    public const string ResetCheckRoute = "/api/v1/auth/password/reset/check";

    /// <summary>The reset route.</summary>
    public const string ResetRoute = "/api/v1/auth/password/reset";

    /// <summary>The set-new-password route (the must-change step).</summary>
    public const string SetNewPasswordRoute = "/api/v1/auth/password/set-new";

    /// <summary>The pending-login ticket cookie name.</summary>
    public const string TicketCookieName = "__Secure-csps_2fa";

    /// <summary>The refresh cookie name.</summary>
    public const string RefreshCookieName = "__Secure-csps_rt";

    /// <summary>The anti-CSRF header every cookie-reading auth call carries.</summary>
    public const string CsrfHeader = "X-CSPS-CSRF";

    /// <summary>The header every covered POST carries (SEC-06); the web client sends one key per submission.</summary>
    public const string IdempotencyKeyHeader = "Idempotency-Key";

    /// <summary>The response header that marks a stored answer sent again.</summary>
    public const string ReplayedHeader = "Idempotent-Replayed";

    /// <summary>A Chrome on Android User-Agent.</summary>
    public const string ChromeOnAndroid =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(5);

    /// <summary>Creates an https client that keeps cookies, so Secure cookies flow (the Testing host does not redirect).</summary>
    /// <param name="factory">The test host.</param>
    /// <returns>The client. The caller disposes it.</returns>
    public static HttpClient CreateClient(WebApplicationFactory<Program> factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        return factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = true,
            AllowAutoRedirect = false,
        });
    }

    /// <summary>Creates a staff account in the given state.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="state">The state to start in.</param>
    /// <param name="role">The role.</param>
    /// <returns>The account and its password.</returns>
    public static async Task<TestStaff> CreateStaffAsync(WebApplicationFactory<Program> factory, StaffState state = StaffState.Active, string role = Roles.Manager)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var email = NewEmail();
        var password = $"Pw-{Guid.NewGuid():N}!x";
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            var id = await accounts.CreateAsync(
                new NewUserAccount(email, "Paolo", "Reyes", role, state == StaffState.NoPassword ? null : password),
                TestContext.Current.CancellationToken);
            if (state is StaffState.Deactivated or StaffState.Unconfirmed)
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var user = (await users.FindByIdAsync(id.ToString("D"))).ShouldNotBeNull();
                user.IsActive = state != StaffState.Deactivated;
                user.EmailConfirmed = state != StaffState.Unconfirmed;
                (await users.UpdateAsync(user)).Succeeded.ShouldBeTrue();
            }

            return new TestStaff(id, email, password);
        }
    }

    /// <summary>Creates an active staff account with a chosen password, optionally flagged to set a new one (D-21 shape).</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="password">The password the account starts with, saved as given.</param>
    /// <param name="reason">Why the next sign-in ends with a new password; null for none.</param>
    /// <param name="recheckPending">True to mark the password for the late breach re-check (D-18).</param>
    /// <returns>The account and its password.</returns>
    public static async Task<TestStaff> CreateStaffWithPasswordAsync(
        WebApplicationFactory<Program> factory, string password, PasswordChangeReason? reason = null, bool recheckPending = false)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var email = NewEmail();
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            var id = await accounts.CreateAsync(new NewUserAccount(email, "Paolo", "Reyes", Roles.Manager, password), TestContext.Current.CancellationToken);
            if (reason is { } why)
            {
                await accounts.SetMustChangePasswordAsync(id, why, TestContext.Current.CancellationToken);
            }

            if (recheckPending)
            {
                await accounts.MarkBreachRecheckAsync(id, TestContext.Current.CancellationToken);
            }

            return new TestStaff(id, email, password);
        }
    }

    /// <summary>Locks an account for 15 minutes, as the fifth wrong password would.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the account is locked.</returns>
    public static async Task LockAsync(WebApplicationFactory<Program> factory, Guid id)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            await accounts.LockUntilAsync(id, TimeProvider.System.GetUtcNow().AddMinutes(15), TestContext.Current.CancellationToken);
        }
    }

    /// <summary>Deactivates an account.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the account is deactivated.</returns>
    public static async Task DeactivateAsync(WebApplicationFactory<Program> factory, Guid id)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString("D"))).ShouldNotBeNull();
            user.IsActive = false;
            (await users.UpdateAsync(user)).Succeeded.ShouldBeTrue();
        }
    }

    /// <summary>Marks an account as needing a new password at its next sign-in (D-13).</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <param name="reason">Why the password must change.</param>
    /// <returns>A task that completes when the mark is saved.</returns>
    public static async Task RequirePasswordChangeAsync(WebApplicationFactory<Program> factory, Guid id, PasswordChangeReason reason)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            await accounts.SetMustChangePasswordAsync(id, reason, TestContext.Current.CancellationToken);
        }
    }

    /// <summary>Derives a host that reads its UTC time from a test clock.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="clock">The clock the host uses.</param>
    /// <returns>The derived host. The caller disposes it.</returns>
    public static WebApplicationFactory<Program> WithClock(WebApplicationFactory<Program> factory, TimeProvider clock)
    {
        ArgumentNullException.ThrowIfNull(factory);
        ArgumentNullException.ThrowIfNull(clock);
        return factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton(clock);
        }));
    }

    /// <summary>Returns a fresh unique email address.</summary>
    /// <returns>The address.</returns>
    public static string NewEmail() => $"paolo.{Guid.NewGuid():N}@example.com";

    /// <summary>Posts a sign-in.</summary>
    /// <param name="client">The client.</param>
    /// <param name="email">The email.</param>
    /// <param name="password">The password.</param>
    /// <param name="keepSignedIn">The keep-signed-in choice.</param>
    /// <param name="userAgent">The User-Agent to send.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> SignInAsync(
        HttpClient client, string email, string password, bool keepSignedIn = true, string userAgent = ChromeOnAndroid)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(SignInRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { email, password, keepSignedIn }),
        };
        request.Headers.UserAgent.ParseAdd(userAgent);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a forgot-password request.</summary>
    /// <param name="client">The client.</param>
    /// <param name="email">The email to send.</param>
    /// <param name="userAgent">The User-Agent to send.</param>
    /// <param name="idempotencyKey">The request key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ForgotPasswordAsync(
        HttpClient client, string email, string userAgent = ChromeOnAndroid, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(ForgotRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { email }),
        };
        request.Headers.UserAgent.ParseAdd(userAgent);
        request.Headers.Add(IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a reset-link check.</summary>
    /// <param name="client">The client.</param>
    /// <param name="token">The token from the emailed link.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> CheckResetLinkAsync(HttpClient client, string? token)
    {
        ArgumentNullException.ThrowIfNull(client);
        return await client.PostAsJsonAsync(new Uri(ResetCheckRoute, UriKind.Relative), new { token }, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a password reset.</summary>
    /// <param name="client">The client.</param>
    /// <param name="token">The token from the emailed link.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="idempotencyKey">The request key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ResetPasswordAsync(
        HttpClient client, string? token, string? newPassword, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(ResetRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { token, newPassword }),
        };
        request.Headers.Add(IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Asks for a reset link and returns the token in the emailed link.</summary>
    /// <param name="client">The client.</param>
    /// <param name="email">The account email.</param>
    /// <param name="emailsSoFar">How many messages the address already holds.</param>
    /// <returns>The 43-character token.</returns>
    public static async Task<string> RequestResetTokenAsync(HttpClient client, string email, int emailsSoFar = 0)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var forgot = await ForgotPasswordAsync(client, email);
        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var mail = (await WaitForEmailsAsync(client, email, emailsSoFar + 1))[^1];
        var match = TokenInResetLink().Match(mail.Text);
        match.Success.ShouldBeTrue("The newest email is not a reset link email.");
        return match.Groups[1].Value;
    }

    /// <summary>Reads the sink messages to an address after a cursor.</summary>
    /// <param name="client">The client.</param>
    /// <param name="to">The recipient.</param>
    /// <param name="after">The cursor; 0 reads everything.</param>
    /// <returns>The messages, oldest first.</returns>
    public static async Task<IReadOnlyList<SinkEmail>> ReadEmailsAsync(HttpClient client, string to, long after = 0)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var response = await client.GetAsync(
            new Uri($"/api/testing/emails?after={after}&to={Uri.EscapeDataString(to)}", UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);
        return
        [
            .. document.RootElement.EnumerateArray().Select(static item => new SinkEmail(
                item.GetProperty("id").GetInt64(),
                item.GetProperty("to").GetString().ShouldNotBeNull(),
                item.GetProperty("subject").GetString().ShouldNotBeNull(),
                item.GetProperty("text").GetString().ShouldNotBeNull(),
                item.GetProperty("html").GetString().ShouldNotBeNull())),
        ];
    }

    /// <summary>Waits until the sink holds at least <paramref name="count"/> messages to an address.</summary>
    /// <param name="client">The client.</param>
    /// <param name="to">The recipient.</param>
    /// <param name="count">How many messages to wait for.</param>
    /// <param name="after">The cursor.</param>
    /// <returns>The messages.</returns>
    public static async Task<IReadOnlyList<SinkEmail>> WaitForEmailsAsync(HttpClient client, string to, int count = 1, long after = 0)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        limit.CancelAfter(Patience);
        while (!limit.IsCancellationRequested)
        {
            var messages = await ReadEmailsAsync(client, to, after);
            if (messages.Count >= count)
            {
                return messages;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(100), CancellationToken.None);
        }

        throw new TimeoutException($"The sink held fewer than {count} messages for the address within {Patience}.");
    }

    /// <summary>Waits for and returns the newest message to an address.</summary>
    /// <param name="client">The client.</param>
    /// <param name="to">The recipient.</param>
    /// <returns>The latest message.</returns>
    public static async Task<SinkEmail> LatestEmailAsync(HttpClient client, string to) =>
        (await WaitForEmailsAsync(client, to))[^1];

    /// <summary>Reads the six-digit code from the newest sign-in email to an address.</summary>
    /// <param name="client">The client.</param>
    /// <param name="to">The recipient.</param>
    /// <param name="count">How many sign-in emails the sink must hold; the newest is read.</param>
    /// <returns>The code.</returns>
    public static async Task<string> ReadCodeAsync(HttpClient client, string to, int count = 1)
    {
        var mails = await WaitForEmailsAsync(client, to, count);
        var match = CodeInSubject().Match(mails[^1].Subject);
        match.Success.ShouldBeTrue("The newest email is not a sign-in code email.");
        return match.Groups[1].Value;
    }

    /// <summary>Posts a code to the verify route.</summary>
    /// <param name="client">The client holding the ticket cookie.</param>
    /// <param name="code">The code to send.</param>
    /// <param name="csrf">Whether to send the anti-CSRF header.</param>
    /// <param name="userAgent">The User-Agent to send; the session's device label comes from it. None when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> VerifyAsync(HttpClient client, string code, bool csrf = true, string? userAgent = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(VerifyRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { code }),
        };
        if (userAgent is not null)
        {
            request.Headers.UserAgent.ParseAdd(userAgent);
        }

        if (csrf)
        {
            request.Headers.Add(CsrfHeader, "1");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts the new password of the must-change step; the client's cookie jar supplies the ticket.</summary>
    /// <param name="client">The client holding the ticket cookie.</param>
    /// <param name="newPassword">The new password.</param>
    /// <param name="csrf">Whether to send the anti-CSRF header.</param>
    /// <param name="ticket">A ticket cookie value to send explicitly; null sends only the cookies of the client.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> SetNewPasswordAsync(HttpClient client, string? newPassword, bool csrf = true, string? ticket = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(SetNewPasswordRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { newPassword }),
        };
        if (csrf)
        {
            request.Headers.Add(CsrfHeader, "1");
        }

        if (ticket is not null)
        {
            request.Headers.Add("Cookie", $"{TicketCookieName}={ticket}");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the pending-login ticket a sign-in response sets.</summary>
    /// <param name="signIn">The 200 sign-in response.</param>
    /// <returns>The ticket value.</returns>
    public static string TicketOf(HttpResponseMessage signIn)
    {
        ArgumentNullException.ThrowIfNull(signIn);
        return signIn.Headers.GetValues("Set-Cookie").Select(static header => SetCookieHeaderValue.Parse(header))
            .Single(static cookie => cookie.Name.Value == TicketCookieName).Value.Value.ShouldNotBeNull();
    }

    /// <summary>Signs in and verifies the emailed code, leaving the client at the answer of the code step.</summary>
    /// <param name="client">The client (one cookie jar).</param>
    /// <param name="staff">The account.</param>
    /// <param name="signInsSoFar">How many sign-in emails the account already holds.</param>
    /// <returns>The verify response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> SignInThroughCodeAsync(HttpClient client, TestStaff staff, int signInsSoFar = 0)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(staff);
        using var signIn = await SignInAsync(client, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        var code = await ReadCodeAsync(client, staff.Email, signInsSoFar + 1);
        return await VerifyAsync(client, code);
    }

    /// <summary>Posts to the resend route.</summary>
    /// <param name="client">The client holding the ticket cookie.</param>
    /// <param name="csrf">Whether to send the anti-CSRF header.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ResendAsync(HttpClient client, bool csrf = true)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(ResendRoute, UriKind.Relative));
        if (csrf)
        {
            request.Headers.Add(CsrfHeader, "1");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Signs in with the password and the emailed code, so the client holds the refresh cookie.</summary>
    /// <param name="client">The client (one cookie jar per device).</param>
    /// <param name="staff">The account.</param>
    /// <param name="keepSignedIn">The keep-signed-in choice.</param>
    /// <param name="signInsSoFar">How many sign-in emails the account already holds, so the newest code is read.</param>
    /// <param name="userAgent">The User-Agent to sign in with.</param>
    /// <returns>The device's tokens.</returns>
    public static async Task<SignedInDevice> SignInFullyAsync(
        HttpClient client, TestStaff staff, bool keepSignedIn = true, int signInsSoFar = 0, string userAgent = ChromeOnAndroid)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(staff);
        using var signIn = await SignInAsync(client, staff.Email, staff.Password, keepSignedIn, userAgent);
        signIn.StatusCode.ShouldBe(HttpStatusCode.OK);
        var code = await ReadCodeAsync(client, staff.Email, signInsSoFar + 1);
        using var verify = await VerifyAsync(client, code, userAgent: userAgent);
        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        return await ReadDeviceAsync(verify, staff.Id);
    }

    /// <summary>Reads a session response (verify or refresh) and its refresh cookie.</summary>
    /// <param name="response">The 200 response.</param>
    /// <param name="userId">The account id.</param>
    /// <returns>The device's tokens.</returns>
    public static async Task<SignedInDevice> ReadDeviceAsync(HttpResponseMessage response, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(response);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = body.RootElement;
        var session = root.TryGetProperty("session", out var wrapped) ? wrapped : root;
        var accessToken = session.GetProperty("accessToken").GetString().ShouldNotBeNull();
        var cookie = RefreshCookie(response).ShouldNotBeNull();
        var sessionId = Guid.Parse(new JsonWebToken(accessToken).GetClaim("sid").Value);
        return new SignedInDevice(
            userId, sessionId, accessToken, cookie.Value.Value.ShouldNotBeNull(), cookie.Expires, session.GetProperty("sessionExpiresAt").GetDateTimeOffset());
    }

    /// <summary>Finds the refresh cookie a response sets.</summary>
    /// <param name="response">The response.</param>
    /// <returns>The parsed cookie, or null when the response does not set it.</returns>
    public static SetCookieHeaderValue? RefreshCookie(HttpResponseMessage response)
    {
        ArgumentNullException.ThrowIfNull(response);
        if (!response.Headers.TryGetValues("Set-Cookie", out var headers))
        {
            return null;
        }

        return headers.Select(static header => SetCookieHeaderValue.Parse(header))
            .SingleOrDefault(static cookie => cookie.Name.Value == RefreshCookieName);
    }

    /// <summary>Posts to the refresh route.</summary>
    /// <param name="client">The client; its cookie jar supplies the refresh cookie unless one is given.</param>
    /// <param name="refreshToken">A refresh cookie value to send explicitly; null sends only the jar's cookies.</param>
    /// <param name="csrf">Whether to send the anti-CSRF header.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> RefreshAsync(HttpClient client, string? refreshToken = null, bool csrf = true) =>
        PostCookieRouteAsync(client, RefreshRoute, refreshToken, csrf);

    /// <summary>Posts to the sign-out route.</summary>
    /// <param name="client">The client; its cookie jar supplies the refresh cookie unless one is given.</param>
    /// <param name="refreshToken">A refresh cookie value to send explicitly; null sends only the jar's cookies.</param>
    /// <param name="csrf">Whether to send the anti-CSRF header.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> SignOutAsync(HttpClient client, string? refreshToken = null, bool csrf = true) =>
        PostCookieRouteAsync(client, SignOutRoute, refreshToken, csrf);

    /// <summary>Posts to the sign-out-other-devices route with a bearer token.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The caller's access token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> SignOutOthersAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, SignOutOthersRoute, accessToken);
        request.Headers.Add(CsrfHeader, "1");
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Gets the signed-in devices list.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The caller's access token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ListSessionsAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(SessionsRoute, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Signs out one session through the devices API.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The caller's access token; none when null.</param>
    /// <param name="sessionId">The session to sign out.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> RevokeSessionAsync(HttpClient client, string? accessToken, Guid sessionId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{SessionsRoute}/{sessionId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the signed-in devices list of a caller.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The caller's access token.</param>
    /// <returns>The devices, in the order the API sent them.</returns>
    public static async Task<IReadOnlyList<ListedSession>> ReadSessionsAsync(HttpClient client, string accessToken)
    {
        using var response = await ListSessionsAsync(client, accessToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return
        [
            .. body.RootElement.EnumerateArray().Select(static item => new ListedSession(
                item.GetProperty("id").GetGuid(),
                item.GetProperty("device").GetString().ShouldNotBeNull(),
                item.GetProperty("signedInAt").GetDateTimeOffset(),
                item.GetProperty("lastActiveAt").GetDateTimeOffset(),
                item.GetProperty("persistent").GetBoolean(),
                item.GetProperty("current").GetBoolean())),
        ];
    }

    /// <summary>Reads the site settings with an access token and returns the status.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The access token.</param>
    /// <returns>The HTTP status.</returns>
    public static async Task<HttpStatusCode> SiteSettingsStatusAsync(HttpClient client, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get("/api/v1/site-settings", accessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        return response.StatusCode;
    }

    /// <summary>Returns a code that is well formed but is not <paramref name="notThis"/>.</summary>
    /// <param name="notThis">The code to avoid.</param>
    /// <returns>Six digits.</returns>
    public static string WrongCode(string notThis) => notThis == "000000" ? "000001" : "000000";

    private static async Task<HttpResponseMessage> PostCookieRouteAsync(HttpClient client, string route, string? refreshToken, bool csrf)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(route, UriKind.Relative));
        if (csrf)
        {
            request.Headers.Add(CsrfHeader, "1");
        }

        if (refreshToken is not null)
        {
            request.Headers.Add("Cookie", $"{RefreshCookieName}={refreshToken}");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    [GeneratedRegex(@"^(\d{6}) is your CSPS sign-in code$")]
    private static partial Regex CodeInSubject();

    [GeneratedRegex(@"#token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenInResetLink();
}
