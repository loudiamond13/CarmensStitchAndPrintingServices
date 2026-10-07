using Csps.Domain.Common;

namespace Csps.Server.Http;

/// <summary>RED stub of the Result to ProblemDetails mapping.</summary>
public static class ResultHttpExtensions
{
    /// <summary>Stub.</summary>
    /// <param name="result">Result.</param>
    /// <param name="http">Context.</param>
    /// <param name="onSuccess">Success callback.</param>
    /// <returns>An HTTP result.</returns>
    public static IResult ToHttpResult(this Result result, HttpContext http, Func<IResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(onSuccess);
        return result.IsSuccess ? onSuccess() : TypedResults.Problem(CspsProblemDetails.Build(http, StatusCodes.Status500InternalServerError));
    }

    /// <summary>Stub.</summary>
    /// <typeparam name="T">Value type.</typeparam>
    /// <param name="result">Result.</param>
    /// <param name="http">Context.</param>
    /// <param name="onSuccess">Success callback.</param>
    /// <returns>An HTTP result.</returns>
    public static IResult ToHttpResult<T>(this Result<T> result, HttpContext http, Func<T, IResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(onSuccess);
        return result.IsSuccess ? onSuccess(result.Value) : TypedResults.Problem(CspsProblemDetails.Build(http, StatusCodes.Status500InternalServerError));
    }
}
