using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Infrastructure.Identity;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

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

    /// <summary>The anti-CSRF header every cookie-reading auth call carries.</summary>
    public const string CsrfHeader = "X-CSPS-CSRF";

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
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> VerifyAsync(HttpClient client, string code, bool csrf = true)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(VerifyRoute, UriKind.Relative))
        {
            Content = JsonContent.Create(new { code }),
        };
        if (csrf)
        {
            request.Headers.Add(CsrfHeader, "1");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
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

    /// <summary>Returns a code that is well formed but is not <paramref name="notThis"/>.</summary>
    /// <param name="notThis">The code to avoid.</param>
    /// <returns>Six digits.</returns>
    public static string WrongCode(string notThis) => notThis == "000000" ? "000001" : "000000";

    [GeneratedRegex(@"^(\d{6}) is your CSPS sign-in code$")]
    private static partial Regex CodeInSubject();
}
