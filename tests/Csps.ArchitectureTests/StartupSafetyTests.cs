using System.Reflection;
using System.Text.RegularExpressions;
using ArchUnitNET.Domain;
using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using ArchUnitNET.xUnitV3;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace Csps.ArchitectureTests;

/// <summary>
/// D-08, FND-01, Prime Directive 11: nothing migrates, creates, drops or seeds a database at application startup.
/// Schema changes reach production only as reviewed idempotent scripts, and seeding runs only from the explicit
/// <c>tools/Csps.DevSeed</c> command. <c>tools/</c> and <c>tests/</c> are exempt: the dev seed and the test
/// fixtures migrate on purpose.
/// </summary>
public sealed partial class StartupSafetyTests
{
    private static readonly Architecture Architecture = new ArchLoader()
        .LoadAssemblies(typeof(Program).Assembly)
        .Build();

    private static readonly string[] IgnoredDirectoryNames = ["bin", "obj"];

    // The seeding types themselves live in Infrastructure/Seeding; nothing else in src/ may use them.
    private static readonly string SeedingDirectory = Path.Combine("Csps.Infrastructure", "Seeding") + Path.DirectorySeparatorChar;

    [Fact]
    public void SourceNeverMigratesOrSeeds()
    {
        var sourceRoot = RepoRoot.PathOf("src");
        var offenders = new List<string>();

        foreach (var file in SourceFiles(sourceRoot))
        {
            var relative = Path.GetRelativePath(sourceRoot, file);
            var text = File.ReadAllText(file);

            offenders.AddRange(DatabaseLifecycleCall().Matches(text).Select(match => $"{relative}: {match.Value}"));

            if (!relative.StartsWith(SeedingDirectory, StringComparison.Ordinal))
            {
                offenders.AddRange(SeedingReference().Matches(text).Select(match => $"{relative}: {match.Value}"));
            }
        }

        offenders.ShouldBeEmpty("src/ must never migrate, create, drop or seed a database (D-08). Use tools/Csps.DevSeed or a reviewed idempotent script.");
    }

    [Fact]
    public void ServerDoesNotUseEfOrPersistence()
    {
        // NotDependOnAnyTypesThat tests each dependency target itself, so it also sees types from assemblies that
        // are not loaded into the architecture (Infrastructure, EF Core).
        IArchRule rule = Types().That().ResideInAssembly(typeof(Program).Assembly).Should()
            .NotDependOnAnyTypesThat()
            .ResideInNamespaceMatching(@"^(Csps\.Infrastructure\.(Persistence|Seeding)|Microsoft\.EntityFrameworkCore)(\..+)?$");

        rule.Check(Architecture);

        // Reflection backstop: the compiled Server must not even reference an EF Core assembly.
        typeof(Program).Assembly.GetReferencedAssemblies()
            .Select(static (AssemblyName name) => name.Name ?? string.Empty)
            .Where(name => name.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal))
            .ShouldBeEmpty("Csps.Server reaches the database only through Application ports.");
    }

    private static List<string> SourceFiles(string directory)
    {
        var files = new List<string>(Directory.EnumerateFiles(directory, "*.cs"));
        foreach (var child in Directory.EnumerateDirectories(directory))
        {
            if (!IgnoredDirectoryNames.Contains(Path.GetFileName(child), StringComparer.OrdinalIgnoreCase))
            {
                files.AddRange(SourceFiles(child));
            }
        }

        return files;
    }

    // EF Core's migrate, ensure-created and ensure-deleted APIs, and the services behind them.
    [GeneratedRegex(@"\b(Migrate|MigrateAsync|EnsureCreated|EnsureCreatedAsync|EnsureDeleted|EnsureDeletedAsync)\s*\(|\bIMigrator\b|\bIRelationalDatabaseCreator\b|\bIDatabaseCreator\b", RegexOptions.CultureInvariant)]
    private static partial Regex DatabaseLifecycleCall();

    [GeneratedRegex(@"\b(DevSeeder|DevSeedSteps|ISeedStep)\b", RegexOptions.CultureInvariant)]
    private static partial Regex SeedingReference();
}
