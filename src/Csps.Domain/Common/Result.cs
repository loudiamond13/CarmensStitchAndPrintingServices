namespace Csps.Domain.Common;

/// <summary>
/// The outcome of a use case: success, or an expected <see cref="Common.Error"/> (PRD section 3.3). Expected
/// failures are returned, never thrown. Reading <see cref="Error"/> on a success throws.
/// </summary>
public class Result
{
    private readonly Error? _error;

    private protected Result(Error? error) => _error = error;

    /// <summary>True when the use case succeeded.</summary>
    public bool IsSuccess => _error is null;

    /// <summary>True when the use case returned an error.</summary>
    public bool IsFailure => !IsSuccess;

    /// <summary>The error of a failed result.</summary>
    /// <exception cref="InvalidOperationException">When the result is a success.</exception>
    public Error Error => _error ?? throw new InvalidOperationException("A successful result has no error.");

    /// <summary>A success with no value.</summary>
    /// <returns>The result.</returns>
    public static Result Success() => new(null);

    /// <summary>A failure with no value.</summary>
    /// <param name="error">The error.</param>
    /// <returns>The result.</returns>
    public static Result Failure(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result(error);
    }

    /// <summary>A success carrying <paramref name="value"/>.</summary>
    /// <typeparam name="T">The value type.</typeparam>
    /// <param name="value">The value.</param>
    /// <returns>The result.</returns>
    public static Result<T> Success<T>(T value) => new(value, null);

    /// <summary>A failure of a use case that would have returned a <typeparamref name="T"/>.</summary>
    /// <typeparam name="T">The value type.</typeparam>
    /// <param name="error">The error.</param>
    /// <returns>The result.</returns>
    public static Result<T> Failure<T>(Error error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result<T>(default, error);
    }
}

/// <summary>The outcome of a use case that returns a value on success. Reading <see cref="Value"/> on a failure throws.</summary>
/// <typeparam name="T">The value type.</typeparam>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    internal Result(T? value, Error? error)
        : base(error) => _value = value;

    /// <summary>The value of a successful result.</summary>
    /// <exception cref="InvalidOperationException">When the result is a failure.</exception>
    public T Value => IsSuccess ? _value! : throw new InvalidOperationException("A failed result has no value.");
}
