using System.Collections;
using System.Net;
using Csps.Server.Composition;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.FileProviders.Physical;
using Microsoft.Extensions.Primitives;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// WEB-01, L-04: build internals in the web root are never served. Any path with a segment that starts with a dot or
/// contains a tilde, split on <c>/</c> and <c>\</c>, reads as missing for file lookups and directory listings, so a
/// request for one gets the same anonymous ProblemDetails 404 as any missing file, with no file metadata (CWE-538,
/// CWE-41, CWE-58, CWE-204). The app's own files are unchanged.
/// </summary>
public sealed class HiddenSegmentFileProviderTests
{
    private const string FixtureHiddenMarker = "must never be served";

    [Theory]
    // Vite's build.license output, in any case. System.Uri decodes %2E before sending, so the encoded row reaches the
    // host as the plain one; the case row needs the case-insensitive file system to resolve.
    [InlineData("GET", "/.vite/license.md", ".vite/license.md")]
    [InlineData("GET", "/.VITE/LICENSE.MD", ".vite/license.md")]
    [InlineData("GET", "/%2Evite/license.md", ".vite/license.md")]
    // Windows path equivalences (CWE-41, CWE-58): a backslash is a separator, and NTFS 8.3 short names alias .vite as
    // VITE~1 where short names are generated.
    [InlineData("GET", "/assets%5C..%5C.vite%5Clicense.md", ".vite/license.md")]
    [InlineData("GET", "/VITE~1/license.md", ".vite/license.md")]
    // A file nested in any dot folder, not only .vite.
    [InlineData("GET", "/.x/y.txt", ".x/y.txt")]
    [InlineData("HEAD", "/.vite/license.md", ".vite/license.md")]
    [InlineData("HEAD", "/.VITE/LICENSE.MD", ".vite/license.md")]
    [InlineData("HEAD", "/%2Evite/license.md", ".vite/license.md")]
    [InlineData("HEAD", "/assets%5C..%5C.vite%5Clicense.md", ".vite/license.md")]
    [InlineData("HEAD", "/VITE~1/license.md", ".vite/license.md")]
    [InlineData("HEAD", "/.x/y.txt", ".x/y.txt")]
    public async Task DotFolderFilesAre404(string method, string path, string fixtureFile)
    {
        // Non-vacuous guard: the hidden fixture really is in the served web root.
        File.Exists(Path.Combine(CspsApiFactory.FixtureWebRoot, fixtureFile))
            .ShouldBeTrue($"fixture {fixtureFile} is missing from the test output");
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(new HttpMethod(method), path);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        var label = $"{method} {path}";
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound, label);
        response.Content.Headers.ContentType.ShouldNotBeNull(label).MediaType.ShouldBe(ProblemJson.MediaType, label);

        // A hidden file is indistinguishable from a missing one (CWE-204): no ETag, date or range support leaks.
        response.Headers.ETag.ShouldBeNull(label);
        response.Content.Headers.LastModified.ShouldBeNull(label);
        response.Headers.AcceptRanges.ShouldBeEmpty(label);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain(FixtureHiddenMarker, Case.Insensitive, label);
        if (method == "HEAD")
        {
            // RFC 9110: HEAD gets the GET headers and no content, exactly like HEAD on a file that does not exist.
            body.ShouldBeEmpty(label);
            using var missingHead = ApiRequests.Create(HttpMethod.Head, "/missing.js");
            using var missingHeadResponse = await client.SendAsync(missingHead, TestContext.Current.CancellationToken);
            missingHeadResponse.StatusCode.ShouldBe(response.StatusCode, label);
            missingHeadResponse.Content.Headers.ContentType.ShouldBe(response.Content.Headers.ContentType, label);
            return;
        }

        using var missingResponse = await client.GetAsync(new Uri("/missing.js", UriKind.Relative), TestContext.Current.CancellationToken);
        var missing = await ProblemJson.ReadAsync(missingResponse, TestContext.Current.CancellationToken);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe(missing.GetProperty("title").GetString(), label);
        problem.GetProperty("status").GetInt32().ShouldBe(missing.GetProperty("status").GetInt32(), label);
        ProblemJson.TraceId(problem);
    }

    [Theory]
    [InlineData("/.vite/license.md", true)]
    [InlineData(".vite/license.md", true)]
    [InlineData("/.VITE/LICENSE.MD", true)]
    [InlineData("/.x/y.txt", true)]
    [InlineData("/assets/.x/y.js", true)]
    [InlineData("/.env", true)]
    [InlineData("/assets/..", true)]
    [InlineData("//.vite//license.md", true)]
    [InlineData(@"assets\..\.vite\x", true)]
    [InlineData(@"\.vite\license.md", true)]
    [InlineData("/VITE~1/license.md", true)]
    [InlineData("/vite~1/license.md", true)]
    [InlineData("/INDEX~1.HTM", true)]
    [InlineData("/assets/a~b.js", true)]
    [InlineData("/assets/app-fixture.js", false)]
    [InlineData("/assets/app.js", false)]
    [InlineData("/index.html", false)]
    [InlineData("/robots.txt", false)]
    [InlineData("/assets/index-AbC12_-x.js", false)]
    [InlineData("/assets/a.b.c.js", false)]
    [InlineData("/", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsHiddenRules(string? subpath, bool expected) =>
        HiddenSegmentFileProvider.IsHidden(subpath).ShouldBe(expected, subpath ?? "<null>");

    [Fact]
    public void HiddenFileIsMissingWithoutAskingTheInnerProvider()
    {
        var inner = new RecordingFileProvider();
        var provider = new HiddenSegmentFileProvider(inner);

        var file = provider.GetFileInfo("/.vite/license.md");

        file.Exists.ShouldBeFalse();
        inner.Calls.ShouldBeEmpty();
    }

    [Fact]
    public void VisibleFileIsTheInnerProvidersOwnInstance()
    {
        var inner = new RecordingFileProvider();
        var provider = new HiddenSegmentFileProvider(inner);

        var file = provider.GetFileInfo("/assets/app.js");

        file.ShouldBeSameAs(inner.File);
        inner.Calls.ShouldBe(["file:/assets/app.js"]);
    }

    [Fact]
    public void RealWebRootAppFileIsUnchanged()
    {
        using var inner = new PhysicalFileProvider(CspsApiFactory.FixtureWebRoot);
        var provider = new HiddenSegmentFileProvider(inner);

        var file = provider.GetFileInfo("/assets/app-fixture.js");

        file.Exists.ShouldBeTrue();
        file.PhysicalPath.ShouldBe(inner.GetFileInfo("/assets/app-fixture.js").PhysicalPath);
    }

    [Fact]
    public void DirectoryListingsHideSegments()
    {
        // The inner provider here applies no exclusion filter, so it lists the dot folders and only the wrapper hides them.
        using var inner = new PhysicalFileProvider(CspsApiFactory.FixtureWebRoot, ExclusionFilters.None);
        var provider = new HiddenSegmentFileProvider(inner);
        inner.GetDirectoryContents("/.vite").Exists.ShouldBeTrue("the fixture folder must exist for this test to mean anything");
        inner.GetDirectoryContents("/").Select(static entry => entry.Name).ShouldContain(".vite");
        inner.GetDirectoryContents("/").Select(static entry => entry.Name).ShouldContain(".x");

        var hidden = provider.GetDirectoryContents("/.vite");
        var root = provider.GetDirectoryContents("/");

        hidden.ShouldBeSameAs(NotFoundDirectoryContents.Singleton);
        root.Exists.ShouldBeTrue();
        var names = root.Select(static entry => entry.Name).ToList();
        names.ShouldNotContain(".vite");
        names.ShouldNotContain(".x");
        names.ShouldContain("index.html");
        names.ShouldContain("assets");
    }

    [Fact]
    public void VisibleListingOmitsTildeAndDotEntries()
    {
        var inner = new RecordingFileProvider(new FakeFile("index.html"), new FakeFile(".cache"), new FakeFile("VITE~1"));
        var provider = new HiddenSegmentFileProvider(inner);

        var contents = provider.GetDirectoryContents("/");

        contents.Exists.ShouldBeTrue();
        contents.Select(static entry => entry.Name).ShouldBe(["index.html"]);
    }

    [Fact]
    public void HiddenListingNeverAsksTheInnerProvider()
    {
        var inner = new RecordingFileProvider(new FakeFile("license.md"));
        var provider = new HiddenSegmentFileProvider(inner);

        var contents = provider.GetDirectoryContents("/VITE~1");

        contents.Exists.ShouldBeFalse();
        contents.ShouldBeEmpty();
        inner.Calls.ShouldBeEmpty();
    }

    [Fact]
    public void MissingListingIsPassedThrough()
    {
        using var inner = new PhysicalFileProvider(CspsApiFactory.FixtureWebRoot);
        var provider = new HiddenSegmentFileProvider(inner);

        provider.GetDirectoryContents("/no-such-folder").Exists.ShouldBeFalse();
    }

    [Fact]
    public void WatchReturnsTheInnerToken()
    {
        var inner = new RecordingFileProvider();
        var provider = new HiddenSegmentFileProvider(inner);

        var token = provider.Watch("**/*.js");

        token.ShouldBeSameAs(inner.Token);
        inner.Calls.ShouldBe(["watch:**/*.js"]);
    }

    // NET-WR-03: the rule protects the web root itself, not one middleware's copy of it, so the shell fallback, any
    // later UseDefaultFiles/UseFileServer and any service reading IWebHostEnvironment all get the same L-04 rule.
    [Fact]
    public async Task TheHostsWebRootProviderIsTheWrapper()
    {
        File.Exists(Path.Combine(CspsApiFactory.FixtureWebRoot, ".vite", "license.md"))
            .ShouldBeTrue("the hidden fixture must exist for this test to mean anything");
        await using var factory = new CspsApiFactory();

        var webRoot = factory.Services.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider;

        webRoot.ShouldBeOfType<HiddenSegmentFileProvider>();
        webRoot.GetFileInfo("/.vite/license.md").Exists.ShouldBeFalse();
        webRoot.GetFileInfo("/assets/app-fixture.js").Exists.ShouldBeTrue();
    }

    [Fact]
    public void ConstructorRefusesANullInnerProvider() =>
        Should.Throw<ArgumentNullException>(() => new HiddenSegmentFileProvider(null!));

    /// <summary>An inner provider that records each call and answers with fixed instances.</summary>
    private sealed class RecordingFileProvider(params IFileInfo[] listing) : IFileProvider
    {
        public List<string> Calls { get; } = [];

        public IFileInfo File { get; } = new FakeFile("app.js");

        public IChangeToken Token { get; } = new CancellationChangeToken(CancellationToken.None);

        public IFileInfo GetFileInfo(string subpath)
        {
            Calls.Add($"file:{subpath}");
            return File;
        }

        public IDirectoryContents GetDirectoryContents(string subpath)
        {
            Calls.Add($"dir:{subpath}");
            return new FakeDirectory(listing);
        }

        public IChangeToken Watch(string filter)
        {
            Calls.Add($"watch:{filter}");
            return Token;
        }
    }

    /// <summary>An existing directory listing over fixed entries.</summary>
    private sealed class FakeDirectory(IReadOnlyList<IFileInfo> entries) : IDirectoryContents
    {
        public bool Exists => true;

        public IEnumerator<IFileInfo> GetEnumerator() => entries.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    /// <summary>An existing file with only a name.</summary>
    private sealed class FakeFile(string name) : IFileInfo
    {
        public bool Exists => true;

        public long Length => 0;

        public string? PhysicalPath => null;

        public string Name => name;

        public DateTimeOffset LastModified => DateTimeOffset.UnixEpoch;

        public bool IsDirectory => false;

        public Stream CreateReadStream() => Stream.Null;
    }
}
