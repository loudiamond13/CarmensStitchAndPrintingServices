namespace Csps.Server.Security;

/// <summary>
/// Takes a POST action out of the Idempotency-Key gate (SEC-06, D-40). Every POST is covered unless it carries this
/// attribute with a written reason, and the reason must also be listed in the test project's allow-list, so an
/// exemption is always a recorded decision.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class IdempotencyExemptAttribute : Attribute
{
    /// <summary>Initializes a new instance of the <see cref="IdempotencyExemptAttribute"/> class.</summary>
    /// <param name="reason">Why a repeat of this POST must not be stored and replayed.</param>
    /// <exception cref="ArgumentException"><paramref name="reason"/> is null, empty or blank.</exception>
    public IdempotencyExemptAttribute(string reason)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);
        Reason = reason;
    }

    /// <summary>Gets why the endpoint is exempt.</summary>
    public string Reason { get; }
}
