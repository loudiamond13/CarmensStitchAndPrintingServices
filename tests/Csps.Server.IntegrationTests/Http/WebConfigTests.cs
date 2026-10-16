using System.Globalization;
using System.Xml.Linq;
using Csps.Server.Http;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// SEC-01, OPS-05: the IIS web.config hosts in-process, hides the Server and X-Powered-By banners, never compresses
/// (the app does) and holds no rewrite rule until the host is proven to have the URL Rewrite module.
/// </summary>
public sealed class WebConfigTests
{
    private const string RelativePath = "src/Csps.Server/web.config";

    [Fact]
    public void HostsInProcess()
    {
        var aspNetCore = Load().Descendants("aspNetCore").ShouldHaveSingleItem();

        aspNetCore.Attribute("hostingModel").ShouldNotBeNull().Value.ShouldBe("inprocess");
        aspNetCore.Attribute("processPath").ShouldNotBeNull().Value.ShouldBe("dotnet");
        aspNetCore.Attribute("arguments").ShouldNotBeNull().Value.ShouldBe(@".\Csps.Server.dll");
        aspNetCore.Attribute("stdoutLogEnabled").ShouldNotBeNull().Value.ShouldBe("false");
    }

    [Fact]
    public void RemovesTheServerHeader()
    {
        var requestFiltering = Load().Descendants("security").Elements("requestFiltering").ShouldHaveSingleItem();

        requestFiltering.Attribute("removeServerHeader").ShouldNotBeNull().Value.ShouldBe("true");
    }

    [Fact]
    public void IisCeilingSitsAboveTheAppBodyLimit()
    {
        var limits = Load().Descendants("security").Elements("requestFiltering").Elements("requestLimits").ShouldHaveSingleItem();

        var ceiling = limits.Attribute("maxAllowedContentLength").ShouldNotBeNull().Value;

        ceiling.ShouldBe("2097152");
        long.Parse(ceiling, CultureInfo.InvariantCulture).ShouldBeGreaterThan(RequestBodyLimitMiddleware.MaxBytes);
    }

    [Fact]
    public void RemovesXPoweredBy()
    {
        var removed = Load().Descendants("httpProtocol").Elements("customHeaders").Elements("remove")
            .Select(element => element.Attribute("name")?.Value);

        removed.ShouldContain("X-Powered-By");
    }

    [Fact]
    public void TurnsIisCompressionOff()
    {
        var compression = Load().Descendants("system.webServer").Elements("urlCompression").ShouldHaveSingleItem();

        compression.Attribute("doStaticCompression").ShouldNotBeNull().Value.ShouldBe("false");
        compression.Attribute("doDynamicCompression").ShouldNotBeNull().Value.ShouldBe("false");
    }

    [Fact]
    public void HasNoRewriteSectionYet()
    {
        Load().Descendants("rewrite").ShouldBeEmpty();
    }

    private static XDocument Load()
    {
        var path = Path.Combine(RepositoryRoot(), RelativePath.Replace('/', Path.DirectorySeparatorChar));
        File.Exists(path).ShouldBeTrue($"{RelativePath} must exist");
        return XDocument.Load(path);
    }

    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Csps.slnx")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"Could not find Csps.slnx above {AppContext.BaseDirectory}.");
    }
}
