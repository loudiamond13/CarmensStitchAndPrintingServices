namespace Csps.Server.Security;

/// <summary>Which pool of upload slots an upload action takes from.</summary>
public enum UploadSlotPool
{
    /// <summary>The staff pool: two uploads at a time across the app (T-09-27).</summary>
    Staff = 0,

    /// <summary>The pool of anonymous visitors (D-39); staff uploads never wait on it.</summary>
    Public = 1,
}

/// <summary>
/// Marks a photo upload action, so <see cref="UploadSlotsMiddleware"/> holds it to a cap on uploads at a time (T-09-27, CWE-770).
/// Every action that carries the image upload rate limit takes this mark too. Staff actions use the staff pool; the anonymous quote
/// photo action uses its own public pool.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class UploadSlotAttribute : Attribute
{
    /// <summary>Gets the pool the action takes a slot from; the staff pool unless set.</summary>
    public UploadSlotPool Pool { get; init; } = UploadSlotPool.Staff;
}
