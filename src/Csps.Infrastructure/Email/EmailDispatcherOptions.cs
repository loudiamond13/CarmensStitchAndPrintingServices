namespace Csps.Infrastructure.Email;

/// <summary>Settings of the background dispatcher that sends outbox mail (<c>Email:Dispatcher</c>).</summary>
public sealed class EmailDispatcherOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Email:Dispatcher";

    /// <summary>Gets or sets whether the dispatcher runs. Tests that must not send turn it off.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Gets or sets how long the dispatcher waits between sweeps when no commit signals it.</summary>
    public TimeSpan SweepInterval { get; set; } = TimeSpan.FromSeconds(30);
}
