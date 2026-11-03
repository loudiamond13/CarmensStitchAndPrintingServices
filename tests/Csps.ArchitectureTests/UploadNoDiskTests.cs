using System.Reflection;
using System.Text.RegularExpressions;
using Csps.Application.Images;
using Csps.Server.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace Csps.ArchitectureTests;

/// <summary>
/// IMG-02, T-09-03: a photo upload is held in memory and never touches the disk. The upload code names no file API or temp path, and the
/// Upload action keeps every form file in memory, because ASP.NET Core moves a buffered file above <c>MemoryBufferThreshold</c> to a
/// temp file, so the threshold has to sit above the largest body the action accepts.
/// </summary>
public sealed partial class UploadNoDiskTests
{
    private static readonly string[] UploadFiles =
    [
        "src/Csps.Application/Orders/UploadOrderImageHandler.cs",
        "src/Csps.Application/Images/ImageInspection.cs",
        "src/Csps.Application/Images/ImageSniffer.cs",
        "src/Csps.Server/Controllers/OrderImagesController.cs",
    ];

    private static readonly string[] CommentPrefixes = ["//", "/*", "*"];

    [Fact]
    public void TheUploadCodeUsesNoFileApiAndNoTempPath()
    {
        var offenders = UploadFiles
            .SelectMany(relative => File.ReadLines(RepoRoot.PathOf(relative)).Select((line, index) => (relative, line, number: index + 1)))
            .Where(entry => Offends(entry.line))
            .Select(entry => $"{entry.relative}:{entry.number}: {entry.line.Trim()}")
            .ToList();

        offenders.ShouldBeEmpty("Uploads stay in memory (IMG-02): no File., FileStream, Path.GetTempFileName or Path.GetTempPath in the upload code.");
    }

    [Fact]
    public void EveryUploadFileIsReallyScanned() =>
        UploadFiles.ShouldAllBe(relative => File.Exists(RepoRoot.PathOf(relative)));

    [Fact]
    public void TheUploadActionKeepsFormFilesInMemoryByRaisingTheThresholdAboveTheBodyLimit()
    {
        var action = typeof(OrderImagesController).GetMethod(nameof(OrderImagesController.Upload)).ShouldNotBeNull();

        var limits = action.GetCustomAttribute<RequestFormLimitsAttribute>().ShouldNotBeNull();

        ((long)limits.MemoryBufferThreshold).ShouldBeGreaterThan(limits.MultipartBodyLengthLimit);
        limits.MultipartBodyLengthLimit.ShouldBeGreaterThanOrEqualTo(ImageUploadLimits.MaxFileBytes);
    }

    [Theory]
    [InlineData("using var stream = File.OpenRead(path);")]
    [InlineData("await File.WriteAllBytesAsync(path, bytes);")]
    [InlineData("var stream = new FileStream(path, FileMode.Create);")]
    [InlineData("var path = Path.GetTempFileName();")]
    [InlineData("var folder = Path.GetTempPath();")]
    public void TheScannerFlagsEachDiskUse(string line) => Offends(line).ShouldBeTrue();

    [Theory]
    [InlineData("var request = new UploadOrderImageRequest(buffer, file?.FileName, description);")]
    [InlineData("IFormFile? file,")]
    [InlineData("await file.CopyToAsync(buffer, cancellationToken);")]
    [InlineData("    // Never use File.WriteAllBytes or Path.GetTempPath here.")]
    [InlineData("    /// <summary>Not a FileStream.</summary>")]
    [InlineData("private const string FileField = \"file\";")]
    public void TheScannerAllowsMemoryCopiesAndComments(string line) => Offends(line).ShouldBeFalse();

    // A comment-only line is skipped so documentation may name the banned calls.
    private static bool Offends(string line)
    {
        var trimmed = line.TrimStart();
        return !CommentPrefixes.Any(prefix => trimmed.StartsWith(prefix, StringComparison.Ordinal)) && DiskUse().IsMatch(line);
    }

    [GeneratedRegex(@"(?<![A-Za-z0-9_])File\.|\bFileStream\b|\bPath\.GetTempFileName\b|\bPath\.GetTempPath\b")]
    private static partial Regex DiskUse();
}
