using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Http;

/// <summary>
/// The single place every RFC 9457 ProblemDetails gets its plain-English title, its <c>traceId</c> and, for
/// server errors, the fixed reference text (FND-05, D-26, D-27). Exception text never reaches a response.
/// </summary>
public static class CspsProblemDetails
{
    /// <summary>The ProblemDetails extension that carries the correlation id.</summary>
    public const string TraceIdKey = "traceId";

    /// <summary>The ProblemDetails extension that carries a use-case error's machine code.</summary>
    public const string CodeKey = "code";

    /// <summary>Builds a complete ProblemDetails for the current request.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <param name="status">The HTTP status code.</param>
    /// <param name="detail">A short plain-English detail. Ignored for 5xx, which always get the reference text.</param>
    /// <param name="errors">Field errors; when given, the result is an <see cref="HttpValidationProblemDetails"/>
    /// whose keys keep the given order.</param>
    /// <param name="code">The stable machine code of a use-case error, sent as the <c>code</c> extension on 4xx only.</param>
    /// <returns>The populated ProblemDetails.</returns>
    public static ProblemDetails Build(HttpContext context, int status, string? detail = null, IDictionary<string, string[]>? errors = null, string? code = null)
    {
        ArgumentNullException.ThrowIfNull(context);

        var problem = errors is null ? new ProblemDetails() : new HttpValidationProblemDetails(errors);
        problem.Status = status;
        problem.Detail = detail;
        Apply(problem, context);
        if (code is not null && status < StatusCodes.Status500InternalServerError)
        {
            problem.Extensions[CodeKey] = code;
        }

        return problem;
    }

    /// <summary>
    /// Applies the CSPS rules to any ProblemDetails, including ones the framework creates: plain-English title,
    /// <c>traceId</c>, and for 5xx the fixed detail "Something went wrong. Reference: &lt;traceId&gt;" with every
    /// other extension removed.
    /// </summary>
    /// <param name="problem">The ProblemDetails to update.</param>
    /// <param name="context">The current HTTP context.</param>
    public static void Apply(ProblemDetails problem, HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(problem);
        ArgumentNullException.ThrowIfNull(context);

        var status = problem.Status ?? StatusCodes.Status500InternalServerError;
        var traceId = CorrelationId.For(context);

        problem.Status = status;
        problem.Title = PlainEnglish.TitleFor(status);
        if (status >= StatusCodes.Status500InternalServerError)
        {
            problem.Detail = $"Something went wrong. Reference: {traceId}";
            problem.Extensions.Clear();
        }

        problem.Extensions[TraceIdKey] = traceId;
    }

    /// <summary>
    /// Writes the answer for an unhandled exception: the framework's own client-error status for a bad request (an
    /// oversized body is a 413), a generic 500 for anything else.
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the response is written.</returns>
    public static Task WriteExceptionAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var status = error is BadHttpRequestException { StatusCode: >= StatusCodes.Status400BadRequest and < StatusCodes.Status500InternalServerError } bad
            ? bad.StatusCode
            : StatusCodes.Status500InternalServerError;
        return WriteAsync(context, status);
    }

    /// <summary>
    /// Writes a ProblemDetails for <paramref name="status"/> as <c>application/problem+json</c>, whatever the
    /// request's Accept header says (research Pitfall 5).
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    /// <param name="status">The HTTP status code.</param>
    /// <returns>A task that completes when the response is written.</returns>
    public static Task WriteAsync(HttpContext context, int status)
    {
        ArgumentNullException.ThrowIfNull(context);
        return TypedResults.Problem(Build(context, status)).ExecuteAsync(context);
    }
}
