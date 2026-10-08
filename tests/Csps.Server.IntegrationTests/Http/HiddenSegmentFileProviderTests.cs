using System.Collections;
using Csps.Server.Composition;
using Csps.Testing;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Primitives;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// G-02-2, WEB-01: the web-root wrapper hides every path with a dot-prefixed or tilde segment, split on <c>/</c> and
/// <c>\</c>, from file lookups and directory listings, on every OS (CWE-538, CWE-41, CWE-58), and changes nothing for
/// the app's own files.
/// </summary>
public sealed class HiddenSegmentFileProviderTests
{
    [Theory]
    [InlineData("/.vite/license.md")]
    [InlineData(".vite/license.md")]
    [InlineData("/.VITE/LICENSE.MD")]
    [InlineData("/.x/y.txt")]
    [InlineData("/assets/.x/y.js")]
    [InlineData("/.env")]
    [InlineData("/assets/..")]
    [InlineData("//.vite//license.md")]
    [InlineData(@"/assets\..\.vite\license.md")]
    [InlineData(@"\.vite\license.md")]
    [InlineData("/VITE~1/license.md")]
    [InlineData("/vite~1/license.md")]
    [InlineData("/INDEX~1.HTM")]
    [InlineData("/assets/a~b.js")]
    public void IsHiddenRefusesDotTildeAndBackslashSegments(string subpath) =>
        HiddenSegmentFileProvider.IsHidden(subpath).ShouldBeTrue(subpath);

    [Theory]
    [InlineData("/index.html")]
    [InlineData("/robots.txt")]
    [InlineData("/mark.svg")]
    [InlineData("/assets/index-AbC12_-x.js")]
    [InlineData("/assets/archivo-latin-wght-normal-Q1w2E3.woff2")]
    [InlineData("/assets/a.b.c.js")]
    [InlineData("/")]
    [InlineData("")]
    [InlineData(null)]
    public void IsHiddenKeepsAppFiles(string? subpath) =>
        HiddenSegmentFileProvider.IsHidden(subpath).ShouldBeFalse(subpath ?? "<null>");

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
    public void RealWebRootFileInADotFolderIsHidden()
    {
        using var inner = new PhysicalFileProvider(CspsApiFactory.FixtureWebRoot);
        var provider = new HiddenSegmentFileProvider(inner);

        inner.GetFileInfo("/.vite/license.md").Exists.ShouldBeTrue("the fixture must exist for this test to mean anything");
        provider.GetFileInfo("/.vite/license.md").Exists.ShouldBeFalse();
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
    public void RealWebRootDotFolderListingDoesNotExist()
    {
        using var inner = new PhysicalFileProvider(CspsApiFactory.FixtureWebRoot);
        var provider = new HiddenSegmentFileProvider(inner);

        inner.GetDirectoryContents("/.vite").Exists.ShouldBeTrue("the fixture folder must exist for this test to mean anything");
        provider.GetDirectoryContents("/.vite").Exists.ShouldBeFalse();
    }

    [Fact]
    public void VisibleListingOmitsHiddenEntries()
    {
        var inner = new RecordingFileProvider(new FakeFile("index.html"), new FakeFile(".cache"), new FakeFile("VITE~1"));
        var provider = new HiddenSegmentFileProvider(inner);

        var contents = provider.GetDirectoryContents("/");

        contents.Exists.ShouldBeTrue();
        contents.Select(entry => entry.Name).ShouldBe(["index.html"]);
    }

    [Fact]
    public void HiddenListingNeverAsksTheInnerProvider()
    {
        var inner = new RecordingFileProvider(new FakeFile("license.md"));
        var provider = new HiddenSegmentFileProvider(inner);

        var contents = provider.GetDirectoryContents("/.vite");

        contents.Exists.ShouldBeFalse();
        contents.ShouldBeEmpty();
        inner.Calls.ShouldBeEmpty();
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
