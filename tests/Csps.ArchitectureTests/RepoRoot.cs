namespace Csps.ArchitectureTests;

/// <summary>Locates the repository root (the directory that holds Csps.slnx).</summary>
internal static class RepoRoot
{
    public const string SolutionFileName = "Csps.slnx";

    private static readonly Lazy<string> Root = new(Locate);

    /// <summary>Returns the absolute path of the repository root.</summary>
    public static string Find() => Root.Value;

    /// <summary>Combines the repository root with a repo-relative path written with forward slashes.</summary>
    public static string PathOf(string relativePath) =>
        Path.GetFullPath(Path.Combine(Find(), relativePath.Replace('/', Path.DirectorySeparatorChar)));

    private static string Locate()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, SolutionFileName)))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new InvalidOperationException(
            $"Could not find {SolutionFileName} in any parent of {AppContext.BaseDirectory}.");
    }
}
