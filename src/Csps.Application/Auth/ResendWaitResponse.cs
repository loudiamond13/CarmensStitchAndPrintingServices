namespace Csps.Application.Auth;

/// <summary>What sign-in and a code resend both answer: how long to wait before asking for a new code.</summary>
/// <param name="ResendAfterSeconds">Whole seconds.</param>
public sealed record ResendWaitResponse(int ResendAfterSeconds);
