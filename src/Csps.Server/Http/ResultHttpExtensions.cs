using Csps.Domain.Common;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Csps.Server.Http;

/// <summary>
/// Turns use-case results into HTTP results. Every failure maps here, in one switch, to an RFC 9457
/// ProblemDetails (FND-05, D-26): Validation 400 with <c>errors</c>, NotFound 404, Conflict 409,
/// BusinessRule 422, Forbidden 403.
/// </summary>
public static class ResultHttpExtensions
{
    /// <summary>Maps a result with no value.</summary>
    /// <param name="result">The use-case result.</param>
    /// <param name="http">The current HTTP context.</param>
    /// <param name="onSuccess">Builds the success response.</param>
    /// <returns>The success response, or the ProblemDetails for the failure.</returns>
    public static IResult ToHttpResult(this Result result, HttpContext http, Func<IResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(onSuccess);

        return result.IsSuccess ? onSuccess() : ToProblem(result.Error, http);
    }

    /// <summary>Maps a result that carries a value on success.</summary>
    /// <typeparam name="T">The value type.</typeparam>
    /// <param name="result">The use-case result.</param>
    /// <param name="http">The current HTTP context.</param>
    /// <param name="onSuccess">Builds the success response from the value.</param>
    /// <returns>The success response, or the ProblemDetails for the failure.</returns>
    public static IResult ToHttpResult<T>(this Result<T> result, HttpContext http, Func<T, IResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(onSuccess);

        return result.IsSuccess ? onSuccess(result.Value) : ToProblem(result.Error, http);
    }

    private static ProblemHttpResult ToProblem(Error error, HttpContext http)
    {
        var status = error.Kind switch
        {
            ErrorKind.Validation => StatusCodes.Status400BadRequest,
            ErrorKind.NotFound => StatusCodes.Status404NotFound,
            ErrorKind.Conflict => StatusCodes.Status409Conflict,
            ErrorKind.BusinessRule => StatusCodes.Status422UnprocessableEntity,
            ErrorKind.Forbidden => StatusCodes.Status403Forbidden,
            _ => throw new ArgumentOutOfRangeException(nameof(error), error.Kind, "Unknown error kind."),
        };

        return TypedResults.Problem(CspsProblemDetails.Build(http, status, error.Message, SortedFieldErrors(error)));
    }

    // Ordinal key order, messages in insertion order: identical failures serialize identically (FND-05 ordering edge).
    private static SortedDictionary<string, string[]>? SortedFieldErrors(Error error)
    {
        if (error.FieldErrors is null)
        {
            return null;
        }

        var sorted = new SortedDictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var (field, messages) in error.FieldErrors)
        {
            sorted[field] = [.. messages];
        }

        return sorted;
    }
}
