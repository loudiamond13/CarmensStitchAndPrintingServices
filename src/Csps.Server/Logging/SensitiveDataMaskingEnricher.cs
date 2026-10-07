using Serilog.Core;
using Serilog.Events;

namespace Csps.Server.Logging;

/// <summary>
/// Replaces secret values on every log event before any sink sees it (FND-07, CWE-532). Top-level properties are
/// masked by name. Already-captured structures and dictionaries are walked too, so a secret key inside a logged
/// dictionary is masked as well; objects are normally masked earlier by <see cref="SensitiveDataDestructuringPolicy"/>.
/// The enricher holds no state, so concurrent requests cannot affect each other.
/// </summary>
public sealed class SensitiveDataMaskingEnricher : ILogEventEnricher
{
    private static readonly ScalarValue MaskValue = new(SensitiveDataMasking.Mask);

    /// <inheritdoc />
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        ArgumentNullException.ThrowIfNull(logEvent);

        List<LogEventProperty>? replacements = null;
        foreach (var (name, value) in logEvent.Properties)
        {
            var masked = SensitiveDataMasking.IsSensitive(name) ? MaskValue : MaskNested(value);
            if (!ReferenceEquals(masked, value))
            {
                (replacements ??= []).Add(new LogEventProperty(name, masked));
            }
        }

        if (replacements is null)
        {
            return;
        }

        foreach (var replacement in replacements)
        {
            logEvent.AddOrUpdateProperty(replacement);
        }
    }

    /// <summary>Returns the same instance when nothing inside needed masking, otherwise a masked copy.</summary>
    private static LogEventPropertyValue MaskNested(LogEventPropertyValue value) => value switch
    {
        StructureValue structure => MaskStructure(structure),
        DictionaryValue dictionary => MaskDictionary(dictionary),
        SequenceValue sequence => MaskSequence(sequence),
        _ => value,
    };

    private static StructureValue MaskStructure(StructureValue structure)
    {
        var changed = false;
        var properties = new List<LogEventProperty>(structure.Properties.Count);
        foreach (var property in structure.Properties)
        {
            var masked = SensitiveDataMasking.IsSensitive(property.Name) ? MaskValue : MaskNested(property.Value);
            changed |= !ReferenceEquals(masked, property.Value);
            properties.Add(new LogEventProperty(property.Name, masked));
        }

        return changed ? new StructureValue(properties, structure.TypeTag) : structure;
    }

    private static DictionaryValue MaskDictionary(DictionaryValue dictionary)
    {
        var changed = false;
        var entries = new List<KeyValuePair<ScalarValue, LogEventPropertyValue>>(dictionary.Elements.Count);
        foreach (var (key, value) in dictionary.Elements)
        {
            var masked = key.Value is string name && SensitiveDataMasking.IsSensitive(name) ? MaskValue : MaskNested(value);
            changed |= !ReferenceEquals(masked, value);
            entries.Add(new KeyValuePair<ScalarValue, LogEventPropertyValue>(key, masked));
        }

        return changed ? new DictionaryValue(entries) : dictionary;
    }

    private static SequenceValue MaskSequence(SequenceValue sequence)
    {
        var changed = false;
        var elements = new List<LogEventPropertyValue>(sequence.Elements.Count);
        foreach (var element in sequence.Elements)
        {
            var masked = MaskNested(element);
            changed |= !ReferenceEquals(masked, element);
            elements.Add(masked);
        }

        return changed ? new SequenceValue(elements) : sequence;
    }
}
