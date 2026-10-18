namespace Csps.Application.Ports;

/// <summary>
/// Thrown by <see cref="IUserAccounts.CreateAsync"/> when another account already holds the email, whether Identity's check or
/// the unique normalized-email index found it first (two creates racing for one address). It is an
/// <see cref="InvalidOperationException"/>, so callers that do not expect it still fail loudly. The address is never put in
/// the message.
/// </summary>
public sealed class EmailInUseException()
    : InvalidOperationException("Another account already uses this email.");
