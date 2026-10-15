namespace Csps.Application.Auth;

/// <summary>One signed-in device in the caller's devices list (D-43).</summary>
/// <param name="Id">The session id, used to sign that device out.</param>
/// <param name="Device">The coarse browser-and-device label (D-32).</param>
/// <param name="SignedInAt">When the device signed in.</param>
/// <param name="LastActiveAt">The device's last refresh, or the sign-in.</param>
/// <param name="Persistent">True when "Keep me signed in" was chosen.</param>
/// <param name="Current">True for the device making this request.</param>
public sealed record SessionListItem(Guid Id, string Device, DateTimeOffset SignedInAt, DateTimeOffset LastActiveAt, bool Persistent, bool Current);
