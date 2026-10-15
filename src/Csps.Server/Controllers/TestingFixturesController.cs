#if CSPS_TESTING
using System.Security.Cryptography;
using System.Text.Json;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Infrastructure.Identity;
using Csps.Server.Http;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Gives every E2E test its own staff account (QUAL-05, D-37, Pitfall 8). It exists in the Testing environment of a
/// Debug build only; later plans add more account states here.
/// </summary>
/// <param name="accounts">The staff accounts port.</param>
/// <param name="activation">Deactivates an account.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/staff")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingFixturesController(IUserAccounts accounts, TestingAccountActivation activation) : ControllerBase
{
    private const string Letters = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Digits = "23456789";
    private const string Symbols = "!@#$%^&*-_=+?";
    private const int PasswordLength = 16;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The body of the create call.</summary>
    /// <param name="Role"><c>Admin</c> or <c>Manager</c>.</param>
    /// <param name="State"><c>active</c> (default) or <c>deactivated</c>.</param>
    public sealed record StaffRequest(string? Role, string? State);

    /// <summary>The new account and the password it was created with.</summary>
    /// <param name="UserId">The account id.</param>
    /// <param name="Email">The sign-in email.</param>
    /// <param name="Password">The password, shown once.</param>
    public sealed record StaffCreated(Guid UserId, string Email, string Password);

    /// <summary>Creates a fresh staff account.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the account, or a 400 for a bad body, role or state.</returns>
    [HttpPost]
    [IdempotencyExempt("Testing-only test data, compiled out of Release.")]
    [ProducesResponseType<StaffCreated>(StatusCodes.Status201Created)]
    public async Task<IResult> Create(CancellationToken cancellationToken)
    {
        // Read here, not bound, so a missing or malformed body is the same plain 400 for every caller.
        StaffRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<StaffRequest>(Request.Body, JsonOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException)
        {
            request = null;
        }

        var role = request?.Role;
        var state = request?.State ?? "active";
        if (role is not (Roles.Admin or Roles.Manager))
        {
            return Rejected("The role must be Admin or Manager.", "role");
        }

        if (state is not ("active" or "deactivated"))
        {
            return Rejected("The state must be active or deactivated.", "state");
        }

        var email = $"e2e-{Guid.NewGuid():N}@csps.test";
        var password = NewPassword();
        var id = await accounts.CreateAsync(new NewUserAccount(email, "E2E", "Staff", role, password), cancellationToken).ConfigureAwait(false);
        if (state == "deactivated")
        {
            await activation.DeactivateAsync(id).ConfigureAwait(false);
        }

        return TypedResults.Json(new StaffCreated(id, email, password), JsonOptions, statusCode: StatusCodes.Status201Created);
    }

    private ProblemHttpResult Rejected(string detail, string field) =>
        TypedResults.Problem(CspsProblemDetails.Build(
            HttpContext,
            StatusCodes.Status400BadRequest,
            detail,
            new Dictionary<string, string[]> { [field] = [detail] }));

    // 16 characters that always include a digit and a symbol (D-11), so it passes the same rule as a real password.
    private static string NewPassword()
    {
        var characters = RandomNumberGenerator.GetItems<char>($"{Letters}{Digits}{Symbols}", PasswordLength);
        var digitAt = RandomNumberGenerator.GetInt32(PasswordLength);
        int symbolAt;
        do
        {
            symbolAt = RandomNumberGenerator.GetInt32(PasswordLength);
        }
        while (symbolAt == digitAt);

        characters[digitAt] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];
        characters[symbolAt] = Symbols[RandomNumberGenerator.GetInt32(Symbols.Length)];
        return new string(characters);
    }
}
#endif
