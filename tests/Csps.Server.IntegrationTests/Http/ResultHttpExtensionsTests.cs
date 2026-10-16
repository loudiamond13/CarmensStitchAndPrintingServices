using System.Diagnostics;
using Csps.Domain.Common;
using Csps.Server.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>FND-05, D-26: Result failures map to RFC 9457 responses in one place.</summary>
public sealed class ResultHttpExtensionsTests : IDisposable
{
    private readonly ResultHarness _harness = new();

    [Fact]
    public async Task ValidationIs400WithOrdinalSortedErrors()
    {
        using var activity = new Activity("csps-test").Start();
        var fieldErrors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["zeta"] = ["Second rule.", "First rule."],
            ["alpha"] = ["Enter a value."],
            ["Zulu"] = ["Pick one."],
        };
        var result = Result.Failure(Error.Validation("order.invalid", "Check the highlighted fields.", fieldErrors));
        var http = _harness.NewContext();

        var (text, problem) = await ResultHarness.ExecuteAsync(result.ToHttpResult(http, () => TypedResults.NoContent()), http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status400BadRequest);
        problem.GetProperty("status").GetInt32().ShouldBe(400);
        problem.GetProperty("title").GetString().ShouldBe("Some details need fixing.");
        problem.GetProperty("detail").GetString().ShouldBe("Check the highlighted fields.");
        problem.GetProperty("traceId").GetString().ShouldBe(activity.TraceId.ToHexString());
        var errors = problem.GetProperty("errors");
        errors.EnumerateObject().Select(p => p.Name).ShouldBe(["Zulu", "alpha", "zeta"]);
        errors.GetProperty("zeta").EnumerateArray().Select(m => m.GetString()).ShouldBe(["Second rule.", "First rule."]);
        text.IndexOf("\"alpha\"", StringComparison.Ordinal).ShouldBeLessThan(text.IndexOf("\"zeta\"", StringComparison.Ordinal));
    }

    [Fact]
    public async Task IdenticalValidationFailuresSerializeIdentically()
    {
        var first = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["b"] = ["One."], ["a"] = ["Two."] };
        var second = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["a"] = ["Two."], ["b"] = ["One."] };

        var firstErrors = await ErrorsTextAsync(first);
        var secondErrors = await ErrorsTextAsync(second);

        firstErrors.ShouldBe(secondErrors);
    }

    [Theory]
    [InlineData(ErrorKind.NotFound, 404, "We couldn't find that.")]
    [InlineData(ErrorKind.Conflict, 409, "This was changed by someone else.")]
    [InlineData(ErrorKind.BusinessRule, 422, "That can't be done.")]
    [InlineData(ErrorKind.Forbidden, 403, "You don't have access to this.")]
    public async Task FailureKindMapsToStatusAndTitle(ErrorKind kind, int status, string title)
    {
        using var activity = new Activity("csps-test").Start();
        var error = kind switch
        {
            ErrorKind.NotFound => Error.NotFound("thing.not-found", "We couldn't find that order."),
            ErrorKind.Conflict => Error.Conflict("thing.changed", "This order was changed by someone else."),
            ErrorKind.BusinessRule => Error.BusinessRule("thing.rule", "That payment is more than the balance."),
            _ => Error.Forbidden("thing.forbidden", "Only an Admin can do that."),
        };
        var http = _harness.NewContext();

        var (_, problem) = await ResultHarness.ExecuteAsync(Result.Failure<int>(error).ToHttpResult(http, value => TypedResults.Ok(value)), http);

        http.Response.StatusCode.ShouldBe(status);
        problem.GetProperty("status").GetInt32().ShouldBe(status);
        problem.GetProperty("title").GetString().ShouldBe(title);
        problem.GetProperty("detail").GetString().ShouldBe(error.Message);
        problem.GetProperty("traceId").GetString().ShouldBe(activity.TraceId.ToHexString());
        problem.TryGetProperty("errors", out _).ShouldBeFalse();
    }

    [Fact]
    public async Task NonGenericFailureMapsToo()
    {
        var http = _harness.NewContext();

        var (_, problem) = await ResultHarness.ExecuteAsync(
            Result.Failure(Error.Conflict("order.changed", "This order was changed by someone else.")).ToHttpResult(http, () => TypedResults.NoContent()),
            http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status409Conflict);
        problem.GetProperty("title").GetString().ShouldBe("This was changed by someone else.");
    }

    [Fact]
    public async Task UnauthenticatedIs401WithTheCodeAndNoChallengeHeader()
    {
        using var activity = new Activity("csps-test").Start();
        var http = _harness.NewContext();
        var result = Result.Failure(Error.Unauthenticated("auth.invalid-credentials", "Email or password is incorrect."));

        var (_, problem) = await ResultHarness.ExecuteAsync(result.ToHttpResult(http, () => TypedResults.NoContent()), http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status401Unauthorized);
        problem.GetProperty("title").GetString().ShouldBe("Please sign in to continue.");
        problem.GetProperty("detail").GetString().ShouldBe("Email or password is incorrect.");
        problem.GetProperty("code").GetString().ShouldBe("auth.invalid-credentials");
        problem.GetProperty("traceId").GetString().ShouldBe(activity.TraceId.ToHexString());
        http.Response.Headers.ContainsKey("WWW-Authenticate").ShouldBeFalse();
    }

    [Theory]
    [InlineData(41.2, "42")]
    [InlineData(0.3, "1")]
    [InlineData(60.0, "60")]
    public async Task TooManyRequestsIs429WithAWholeSecondRetryAfter(double seconds, string header)
    {
        var http = _harness.NewContext();
        var error = Error.TooManyRequests("auth.resend-cooldown", "Wait a moment.", TimeSpan.FromSeconds(seconds));

        var (_, problem) = await ResultHarness.ExecuteAsync(Result.Failure(error).ToHttpResult(http, () => TypedResults.NoContent()), http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status429TooManyRequests);
        http.Response.Headers.RetryAfter.ToString().ShouldBe(header);
        problem.GetProperty("code").GetString().ShouldBe("auth.resend-cooldown");
        problem.GetProperty("title").GetString().ShouldBe("Too many requests. Please wait a moment and try again.");
    }

    [Fact]
    public async Task TooManyRequestsWithoutARetryAfterSendsNoHeader()
    {
        var http = _harness.NewContext();
        var error = Error.TooManyRequests("auth.resend-cap", "Too many codes were sent.");

        var (_, problem) = await ResultHarness.ExecuteAsync(Result.Failure(error).ToHttpResult(http, () => TypedResults.NoContent()), http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status429TooManyRequests);
        http.Response.Headers.ContainsKey("Retry-After").ShouldBeFalse();
        problem.GetProperty("code").GetString().ShouldBe("auth.resend-cap");
    }

    [Fact]
    public async Task ValidationCarriesTheCodeAndTheErrors()
    {
        var http = _harness.NewContext();
        var fieldErrors = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["email"] = ["Enter an email."] };
        var result = Result.Failure(Error.Validation("auth.invalid", "Check the highlighted fields.", fieldErrors));

        var (_, problem) = await ResultHarness.ExecuteAsync(result.ToHttpResult(http, () => TypedResults.NoContent()), http);

        http.Response.StatusCode.ShouldBe(StatusCodes.Status400BadRequest);
        problem.GetProperty("code").GetString().ShouldBe("auth.invalid");
        problem.GetProperty("errors").GetProperty("email")[0].GetString().ShouldBe("Enter an email.");
    }

    [Fact]
    public async Task ServerErrorBodiesNeverCarryACode()
    {
        var http = _harness.NewContext();
        var problem = CspsProblemDetails.Build(http, StatusCodes.Status500InternalServerError, "secret text", code: "leak.me");

        var (_, json) = await ResultHarness.ExecuteAsync(TypedResults.Problem(problem), http);

        json.TryGetProperty("code", out _).ShouldBeFalse();
        json.GetProperty("detail").GetString().ShouldStartWith("Something went wrong. Reference: ");
    }

    [Fact]
    public void SuccessInvokesTheSuccessCallback()
    {
        var http = _harness.NewContext();

        Result.Success().ToHttpResult(http, () => TypedResults.NoContent()).ShouldBeOfType<NoContent>();
        Result.Success(5).ToHttpResult(http, value => TypedResults.Ok(value)).ShouldBeOfType<Ok<int>>().Value.ShouldBe(5);
    }

    /// <inheritdoc />
    public void Dispose() => _harness.Dispose();

    private async Task<string> ErrorsTextAsync(Dictionary<string, string[]> fieldErrors)
    {
        var http = _harness.NewContext();
        var result = Result.Failure(Error.Validation("order.invalid", "Check the highlighted fields.", fieldErrors));
        var (_, problem) = await ResultHarness.ExecuteAsync(result.ToHttpResult(http, () => TypedResults.NoContent()), http);
        return problem.GetProperty("errors").GetRawText();
    }
}
