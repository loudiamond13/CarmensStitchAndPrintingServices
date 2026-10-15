namespace Csps.Application.Auth;

/// <summary>The sign-in form: email, password and the "keep me signed in" choice (D-03).</summary>
/// <param name="Email">The email address.</param>
/// <param name="Password">The password, exactly as typed.</param>
/// <param name="KeepSignedIn">True for a 90-day session, false for a browser session.</param>
public sealed record SignInRequest(string? Email, string? Password, bool KeepSignedIn)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static SignInRequest Empty { get; } = new(null, null, false);

    /// <summary>Returns the type name only, so the password never reaches a log.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SignInRequest);
}
