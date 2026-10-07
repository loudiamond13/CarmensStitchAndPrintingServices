using System.Collections;
using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using System.Runtime.CompilerServices;
using Serilog.Core;
using Serilog.Events;

namespace Csps.Server.Logging;

/// <summary>
/// Destructures objects logged with <c>{@Value}</c> while masking secret properties (FND-07, CWE-532), so the
/// secret is never captured into the event at all. It reads public instance properties like Serilog's own
/// reflection, and passes every non-secret value back to Serilog, which applies this policy again to nested objects
/// and enforces the destructuring depth limit. Strings, primitives, enums, collections, delegates, reflection types
/// and exceptions are left to Serilog. The policy holds only a read-only type cache, so it is safe under concurrency.
/// </summary>
public sealed class SensitiveDataDestructuringPolicy : IDestructuringPolicy
{
    private static readonly ScalarValue MaskValue = new(SensitiveDataMasking.Mask);
    private static readonly ConcurrentDictionary<Type, PropertyInfo[]> PropertyCache = new();

    /// <inheritdoc />
    public bool TryDestructure(
        object value,
        ILogEventPropertyValueFactory propertyValueFactory,
        [NotNullWhen(true)] out LogEventPropertyValue? result)
    {
        ArgumentNullException.ThrowIfNull(value);
        ArgumentNullException.ThrowIfNull(propertyValueFactory);

        var type = value.GetType();
        if (!IsPlainObject(value, type))
        {
            result = null;
            return false;
        }

        var properties = PropertyCache.GetOrAdd(type, ReadableProperties);
        var structure = new List<LogEventProperty>(properties.Length);
        foreach (var property in properties)
        {
            var propertyValue = SensitiveDataMasking.IsSensitive(property.Name)
                ? MaskValue
                : propertyValueFactory.CreatePropertyValue(Read(property, value), destructureObjects: true);
            structure.Add(new LogEventProperty(property.Name, propertyValue));
        }

        // Like Serilog, anonymous (compiler-generated) types get no type tag.
        var typeTag = type.IsDefined(typeof(CompilerGeneratedAttribute), inherit: false) ? null : type.Name;
        result = new StructureValue(structure, typeTag);
        return true;
    }

    private static bool IsPlainObject(object value, Type type) =>
        !(type.IsPrimitive || type.IsEnum || type.IsPointer)
        && value is not (string or IEnumerable or Delegate or MemberInfo or Exception);

    private static PropertyInfo[] ReadableProperties(Type type) =>
        [.. type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(static property => property.CanRead
                && property.GetMethod is { IsPublic: true }
                && property.GetIndexParameters().Length == 0
                && !property.PropertyType.IsByRefLike)
            .DistinctBy(static property => property.Name, StringComparer.Ordinal)];

    private static object? Read(PropertyInfo property, object target)
    {
        try
        {
            return property.GetValue(target);
        }
        catch (TargetInvocationException exception)
        {
            // Same wording as Serilog's reflection destructuring; the exception text itself is not logged.
            return $"The property accessor threw an exception: {exception.InnerException?.GetType().Name}";
        }
    }
}
