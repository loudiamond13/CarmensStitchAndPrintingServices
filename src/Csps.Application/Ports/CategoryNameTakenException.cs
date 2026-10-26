namespace Csps.Application.Ports;

/// <summary>
/// Thrown when a save fails because another category already holds the name: the unique normalized-name index found it first, as
/// when two Managers add or rename to one name at the same moment (OQ-10). It is an <see cref="InvalidOperationException"/>, so a
/// caller that does not expect it still fails loudly. The name is never put in the message.
/// </summary>
public sealed class CategoryNameTakenException()
    : InvalidOperationException("Another category already has this name.");
