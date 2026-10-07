using System.Diagnostics.CodeAnalysis;
using Serilog.Core;
using Serilog.Events;

namespace Csps.Server.Logging;

/// <summary>Compile-only stub (TDD RED).</summary>
public sealed class SensitiveDataDestructuringPolicy : IDestructuringPolicy
{
    /// <inheritdoc />
    public bool TryDestructure(object value, ILogEventPropertyValueFactory propertyValueFactory, [NotNullWhen(true)] out LogEventPropertyValue? result)
    {
        result = null;
        return false;
    }
}
