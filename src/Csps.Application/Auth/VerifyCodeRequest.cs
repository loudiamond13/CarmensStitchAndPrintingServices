namespace Csps.Application.Auth;

/// <summary>The code step form: the six digits from the email (AUTH-02).</summary>
/// <param name="Code">The code, exactly as typed.</param>
public sealed record VerifyCodeRequest(string? Code)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports the missing code.</summary>
    public static VerifyCodeRequest Empty { get; } = new(Code: null);

    /// <summary>Returns the type name only, so the code never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(VerifyCodeRequest);
}
