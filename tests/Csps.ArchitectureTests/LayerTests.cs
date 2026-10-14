using System.Reflection;
using System.Xml.Linq;
using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnitV3;
using static ArchUnitNET.Fluent.ArchRuleDefinition;
using ArchAssembly = System.Reflection.Assembly;

namespace Csps.ArchitectureTests;

/// <summary>Onion layer rules (FND-03, PRD section 3.2): Domain &lt;- Application &lt;- Infrastructure &lt;- Server.</summary>
public sealed class LayerTests
{
    private static readonly ArchAssembly DomainAssembly = typeof(Csps.Domain.AssemblyMarker).Assembly;
    private static readonly ArchAssembly ApplicationAssembly = typeof(Csps.Application.AssemblyMarker).Assembly;
    private static readonly ArchAssembly InfrastructureAssembly = typeof(Csps.Infrastructure.AssemblyMarker).Assembly;
    private static readonly ArchAssembly ServerAssembly = typeof(Program).Assembly;

    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(DomainAssembly, ApplicationAssembly, InfrastructureAssembly, ServerAssembly)
        .Build();

    private static readonly IObjectProvider<IType> DomainLayer =
        Types().That().ResideInAssembly(DomainAssembly).As("Domain");

    private static readonly IObjectProvider<IType> ApplicationLayer =
        Types().That().ResideInAssembly(ApplicationAssembly).As("Application");

    private static readonly IObjectProvider<IType> InfrastructureLayer =
        Types().That().ResideInAssembly(InfrastructureAssembly).As("Infrastructure");

    private static readonly IObjectProvider<IType> ServerLayer =
        Types().That().ResideInAssembly(ServerAssembly).As("Server");

    [Fact]
    public void DomainDoesNotDependOnOuterLayers()
    {
        IArchRule rule = Types().That().Are(DomainLayer).Should()
            .NotDependOnAny(Types().That().Are(ApplicationLayer).Or().Are(InfrastructureLayer).Or().Are(ServerLayer));

        rule.Check(Architecture);
    }

    [Fact]
    public void ApplicationDoesNotDependOnInfrastructureOrServer()
    {
        IArchRule rule = Types().That().Are(ApplicationLayer).Should()
            .NotDependOnAny(Types().That().Are(InfrastructureLayer).Or().Are(ServerLayer));

        rule.Check(Architecture);
    }

    [Fact]
    public void InfrastructureDoesNotDependOnServer()
    {
        IArchRule rule = Types().That().Are(InfrastructureLayer).Should().NotDependOnAny(ServerLayer);

        rule.Check(Architecture);
    }

    [Fact]
    public void DomainReferencesOnlyTheBaseClassLibrary()
    {
        var offenders = ReferencedAssemblyNames(DomainAssembly)
            .Where(name => !name.StartsWith("System.", StringComparison.Ordinal)
                && !string.Equals(name, "System", StringComparison.Ordinal)
                && !string.Equals(name, "netstandard", StringComparison.Ordinal)
                && !string.Equals(name, "mscorlib", StringComparison.Ordinal))
            .ToList();

        offenders.ShouldBeEmpty("Csps.Domain may reference only the base class library.");
    }

    [Fact]
    public void ApplicationReferencesNoEfCoreAspNetCoreOrInfrastructure()
    {
        var offenders = ReferencedAssemblyNames(ApplicationAssembly)
            .Where(name => name.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal)
                || name.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal)
                || string.Equals(name, "Csps.Infrastructure", StringComparison.Ordinal)
                || string.Equals(name, "Csps.Server", StringComparison.Ordinal))
            .ToList();

        offenders.ShouldBeEmpty("Csps.Application must not reference EF Core, ASP.NET Core, Infrastructure or Server.");
    }

    [Fact]
    public void InfrastructureDoesNotReferenceServer()
    {
        ReferencedAssemblyNames(InfrastructureAssembly).ShouldNotContain("Csps.Server");
    }

    [Fact]
    public void DomainProjectHasNoPackageReferences()
    {
        var project = XDocument.Load(RepoRoot.PathOf("src/Csps.Domain/Csps.Domain.csproj"));

        // GlobalPackageReference analyzers (Directory.Packages.props) are build-time only and are exempt.
        PackageReferences(project).ShouldBeEmpty("Csps.Domain must be BCL-only (PRD section 3.2).");
    }

    [Fact]
    public void ApplicationProjectReferencesOnlyAllowedPackages()
    {
        var project = XDocument.Load(RepoRoot.PathOf("src/Csps.Application/Csps.Application.csproj"));

        // GlobalPackageReference analyzers (Directory.Packages.props) are build-time only and are exempt.
        var offenders = PackageReferences(project)
            .Where(id => !IsAllowedApplicationPackage(id))
            .ToList();

        offenders.ShouldBeEmpty("Csps.Application may reference only Microsoft.Extensions.*.Abstractions and FluentValidation.");
    }

    private static bool IsAllowedApplicationPackage(string id) =>
        string.Equals(id, "FluentValidation", StringComparison.OrdinalIgnoreCase)
        || (id.StartsWith("Microsoft.Extensions.", StringComparison.OrdinalIgnoreCase)
            && id.EndsWith(".Abstractions", StringComparison.OrdinalIgnoreCase));

    private static List<string> PackageReferences(XDocument project) =>
        project.Descendants()
            .Where(element => string.Equals(element.Name.LocalName, "PackageReference", StringComparison.Ordinal))
            .Select(element => (string?)element.Attribute("Include") ?? (string?)element.Attribute("Update") ?? string.Empty)
            .ToList();

    private static List<string> ReferencedAssemblyNames(ArchAssembly assembly) =>
        assembly.GetReferencedAssemblies()
            .Select(static (AssemblyName name) => name.Name ?? string.Empty)
            .ToList();
}
