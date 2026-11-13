namespace Csps.Server.Security;

/// <summary>
/// Marks a photo upload action, so <see cref="UploadSlotsMiddleware"/> holds it to the app-wide cap of two uploads at a time
/// (T-09-27, CWE-770). Every action that carries the image upload rate limit takes this mark too.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class UploadSlotAttribute : Attribute
{
}
