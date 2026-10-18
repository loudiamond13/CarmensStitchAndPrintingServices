using System.Reflection;
using Csps.Application.Common;

namespace Csps.Application.UnitTests.Common;

/// <summary>USER-06: the audit target id has one formatter; no handler keeps its own copy.</summary>
public sealed class AuditKeyTests
{
    [Fact]
    public void AnIdIsFormattedAsDashedLowerCaseText()
    {
        var id = Guid.Parse("0F8FAD5B-D9CB-469F-A165-70867728950E");

        AuditKey.Of(id).ShouldBe("0f8fad5b-d9cb-469f-a165-70867728950e");
    }

    [Fact]
    public void NoTypeKeepsItsOwnGuidKeyHelper()
    {
        var copies = typeof(AuditKey).Assembly.GetTypes()
            .SelectMany(type => type.GetMethods(BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            .Where(method => method.Name == "Key" && method.ReturnType == typeof(string) && method.GetParameters() is [{ ParameterType: var p }] && p == typeof(Guid))
            .Select(method => method.DeclaringType!.Name)
            .ToList();

        copies.ShouldBeEmpty();
    }
}
