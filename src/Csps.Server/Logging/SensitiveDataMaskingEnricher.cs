using Serilog.Core;
using Serilog.Events;

namespace Csps.Server.Logging;

/// <summary>Compile-only stub (TDD RED).</summary>
public sealed class SensitiveDataMaskingEnricher : ILogEventEnricher
{
    /// <inheritdoc />
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory) => ArgumentNullException.ThrowIfNull(logEvent);
}
