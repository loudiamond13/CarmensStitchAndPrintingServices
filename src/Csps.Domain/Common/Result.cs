namespace Csps.Domain.Common;

/// <summary>RED stub of the outcome type.</summary>
public class Result
{
    private readonly Error? _error;

    private protected Result(Error? error) => _error = error;

    /// <summary>Stub.</summary>
    public bool IsSuccess => _error is null;

    /// <summary>Stub.</summary>
    public bool IsFailure => !IsSuccess;

    /// <summary>Stub.</summary>
    public Error Error => _error!;

    /// <summary>Stub.</summary>
    /// <returns>A result.</returns>
    public static Result Success() => new(null);

    /// <summary>Stub.</summary>
    /// <param name="error">Error.</param>
    /// <returns>A result.</returns>
    public static Result Failure(Error error) => new(error);

    /// <summary>Stub.</summary>
    /// <typeparam name="T">Value type.</typeparam>
    /// <param name="value">Value.</param>
    /// <returns>A result.</returns>
    public static Result<T> Success<T>(T value) => new(value, null);

    /// <summary>Stub.</summary>
    /// <typeparam name="T">Value type.</typeparam>
    /// <param name="error">Error.</param>
    /// <returns>A result.</returns>
    public static Result<T> Failure<T>(Error error) => new(default, error);
}

/// <summary>RED stub of the value-carrying outcome type.</summary>
/// <typeparam name="T">Value type.</typeparam>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    internal Result(T? value, Error? error)
        : base(error) => _value = value;

    /// <summary>Stub.</summary>
    public T Value => _value!;
}
