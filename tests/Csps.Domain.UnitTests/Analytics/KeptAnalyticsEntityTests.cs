using System.Reflection;
using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

// D-80: the seven tables nothing writes any more keep their entities so EF can read and age out old rows.
public sealed class KeptAnalyticsEntityTests
{
    public static TheoryData<Type> Entities =>
    [
        typeof(AnalyticsVisit),
        typeof(AnalyticsPageView),
        typeof(AnalyticsVitalSample),
        typeof(AnalyticsSalt),
        typeof(ConsentRecord),
        typeof(DailyReferrerCount),
        typeof(DailyDeviceCount),
    ];

    [Theory]
    [MemberData(nameof(Entities))]
    public void AnEmptyRowHoldsNoTextOrHashValues(Type entity)
    {
        var row = Create(entity);

        foreach (var property in entity.GetProperties())
        {
            var value = property.GetValue(row);
            if (property.PropertyType == typeof(string))
            {
                value.ShouldBe(string.Empty, property.Name);
            }
            else if (property.PropertyType == typeof(byte[]) && !property.Name.Equals("IpHash", StringComparison.Ordinal))
            {
                ((byte[])value!).ShouldBeEmpty(property.Name);
            }
        }
    }

    [Theory]
    [MemberData(nameof(Entities))]
    public void EveryStoredValueIsReadBackAsItWasSet(Type entity)
    {
        var row = Create(entity);

        foreach (var property in entity.GetProperties())
        {
            var sample = SampleFor(property.PropertyType);
            property.SetValue(row, sample);
            property.GetValue(row).ShouldBe(sample, property.Name);
        }
    }

    private static object Create(Type entity) => Activator.CreateInstance(entity, BindingFlags.Instance | BindingFlags.NonPublic, binder: null, args: null, culture: null)!;

    private static object? SampleFor(Type type)
    {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        return Type.GetTypeCode(underlying) switch
        {
            TypeCode.String => "sample",
            TypeCode.Byte => (byte)2,
            TypeCode.Int32 => 3,
            TypeCode.Int64 => 4L,
            TypeCode.Boolean => true,
            TypeCode.Decimal => 1.5m,
            _ when underlying == typeof(Guid) => Guid.Parse("11111111-1111-1111-1111-111111111111"),
            _ when underlying == typeof(DateOnly) => new DateOnly(2026, 11, 20),
            _ when underlying == typeof(DateTimeOffset) => new DateTimeOffset(2026, 11, 20, 1, 2, 3, TimeSpan.Zero),
            _ when underlying == typeof(byte[]) => new byte[] { 1, 2, 3 },
            _ => throw new InvalidOperationException($"No sample for {type}."),
        };
    }
}
