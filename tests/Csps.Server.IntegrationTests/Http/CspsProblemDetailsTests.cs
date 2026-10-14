using System.Diagnostics;
using Csps.Server.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>D-26, D-27: plain-English titles, and a 5xx never carries exception text.</summary>
public sealed class CspsProblemDetailsTests
{
    [Fact]
    public void FiveHundredHidesDetail()
    {
        using var activity = new Activity("csps-test").Start();
        var traceId = activity.TraceId.ToHexString();

        var problem = CspsProblemDetails.Build(new DefaultHttpContext(), 500, "System.InvalidOperationException: secret");

        problem.Title.ShouldBe("Something went wrong.");
        problem.Detail.ShouldBe($"Something went wrong. Reference: {traceId}");
        problem.Detail.ShouldNotBeNull().ShouldNotContain("Exception");
        problem.Extensions[CspsProblemDetails.TraceIdKey].ShouldBe(traceId);
    }

    [Fact]
    public void ApplyHidesAFrameworkFiveHundred()
    {
        using var activity = new Activity("csps-test").Start();
        var traceId = activity.TraceId.ToHexString();
        var problem = new ProblemDetails
        {
            Status = 500,
            Title = "An error occurred while processing your request.",
            Detail = "System.InvalidOperationException: SELECT secret FROM Users",
        };
        problem.Extensions["exception"] = "at Csps.Secret.Method()";

        CspsProblemDetails.Apply(problem, new DefaultHttpContext());

        problem.Title.ShouldBe("Something went wrong.");
        problem.Detail.ShouldBe($"Something went wrong. Reference: {traceId}");
        problem.Extensions.Keys.ShouldBe([CspsProblemDetails.TraceIdKey]);
    }

    [Fact]
    public void ApplyTreatsAMissingStatusAsAServerError()
    {
        var problem = new ProblemDetails { Detail = "System.Exception: boom" };

        CspsProblemDetails.Apply(problem, new DefaultHttpContext());

        problem.Status.ShouldBe(500);
        problem.Title.ShouldBe("Something went wrong.");
        problem.Detail.ShouldNotBeNull().ShouldStartWith("Something went wrong. Reference: ");
    }

    [Fact]
    public void ServiceUnavailableUsesItsOwnTitle()
    {
        using var activity = new Activity("csps-test").Start();

        var problem = CspsProblemDetails.Build(new DefaultHttpContext(), 503, "Timeout expired. SqlException");

        problem.Title.ShouldBe("The service is busy. Please try again shortly.");
        problem.Detail.ShouldBe($"Something went wrong. Reference: {activity.TraceId.ToHexString()}");
    }

    [Fact]
    public void ClientErrorsKeepTheirPlainEnglishDetail()
    {
        var problem = CspsProblemDetails.Build(new DefaultHttpContext(), 404, "We couldn't find that order.");

        problem.Title.ShouldBe("We couldn't find that.");
        problem.Detail.ShouldBe("We couldn't find that order.");
    }

    [Fact]
    public void FieldErrorsGiveAValidationProblem()
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["name"] = ["Enter a name."] };

        var problem = CspsProblemDetails.Build(new DefaultHttpContext(), 400, "Check the highlighted fields.", errors);

        problem.ShouldBeOfType<HttpValidationProblemDetails>().Errors["name"].ShouldBe(["Enter a name."]);
        problem.Title.ShouldBe("Some details need fixing.");
    }

    [Fact]
    public void WithoutAnActivityAStableW3CTraceIdIsUsed()
    {
        Activity.Current = null;
        var context = new DefaultHttpContext { TraceIdentifier = "fallback-id" };

        var first = CorrelationId.For(context);
        var second = CorrelationId.For(context);

        first.ShouldMatch("^[0-9a-f]{32}$");
        first.ShouldNotBe(new string('0', 32), "an all-zero trace id is invalid in W3C");
        second.ShouldBe(first, "one request keeps one correlation id");
        CorrelationId.For(new DefaultHttpContext()).ShouldNotBe(first, "each request gets its own id");
    }

    [Theory]
    [InlineData(400, "Some details need fixing.")]
    [InlineData(401, "Please sign in to continue.")]
    [InlineData(403, "You don't have access to this.")]
    [InlineData(404, "We couldn't find that.")]
    [InlineData(405, "That action isn't available here.")]
    [InlineData(409, "This was changed by someone else.")]
    [InlineData(415, "That format isn't supported.")]
    [InlineData(418, "That request couldn't be completed.")]
    [InlineData(422, "That can't be done.")]
    [InlineData(429, "Too many requests. Please wait a moment and try again.")]
    [InlineData(500, "Something went wrong.")]
    [InlineData(502, "Something went wrong.")]
    [InlineData(503, "The service is busy. Please try again shortly.")]
    public void TitlesArePlainEnglish(int status, string title)
    {
        PlainEnglish.TitleFor(status).ShouldBe(title);
    }
}
