using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Server.Endpoints;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>A test host with no database whose public site facts come from a stub, so the shell's head can be checked on its own.</summary>
internal sealed class ShellTestFactory(IPublicContentReader reader, ILegalPageCatalog? legalPages = null) : CspsApiFactory
{
    /// <summary>The business name the default stub returns.</summary>
    public const string DefaultBusinessName = "Test Shop's Name & Co";

    public ShellTestFactory()
        : this(new StubPublicContentReader(DefaultBusinessName))
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        base.ConfigureWebHost(builder);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton(reader);
            if (legalPages is not null)
            {
                services.AddSingleton(legalPages);
            }
        });
    }
}

/// <summary>A test-only fact set: the legal pages whose paths are listed are approved, the rest are drafts.</summary>
internal sealed class ApprovedLegalPages(params string[] approvedPaths) : ILegalPageCatalog
{
    public bool IsDraft(string path) =>
        LegalPages.ByPath(path) is not null && !approvedPaths.Contains(path, StringComparer.Ordinal);
}

/// <summary>Returns a fixed public site snapshot, or throws the given exception.</summary>
internal sealed class StubPublicContentReader : IPublicContentReader
{
    /// <summary>The approved tagline, the default of the stub.</summary>
    public const string ApprovedTagline = "Custom tailoring and full-sublimation printing for teams, leagues and riding groups.";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PublicSiteSnapshot? _snapshot;
    private readonly Exception? _failure;

    public StubPublicContentReader(string businessName, string tagline = ApprovedTagline)
        : this(Site(businessName, tagline))
    {
    }

    public StubPublicContentReader(PublicSiteDto site, DateTimeOffset? lastChangedUtc = null) =>
        _snapshot = Snapshot(site, lastChangedUtc ?? new DateTimeOffset(2026, 11, 10, 0, 0, 0, TimeSpan.Zero));

    public StubPublicContentReader(Exception failure) => _failure = failure;

    public static PublicSiteDto Site(string businessName, string tagline = ApprovedTagline) => new(
        businessName,
        tagline,
        null,
        null,
        new PublicAddressDto("12 Sample St., Poblacion", "Sample City", "Sample Province", "1000"),
        [new PublicPhoneDto("0917 123 4567", "+639171234567", "Globe", true), new PublicPhoneDto("02 8123 4567", "+63281234567", null, false)],
        "https://m.me/cspsdemo",
        "https://facebook.example.test/cspsdemo",
        null,
        "https://tiktok.example.test/cspsdemo",
        null,
        null,
        2026,
        [.. Enumerable.Range(1, 7).Select(day => new DayHoursDto(day, null, null))],
        []);

    public static PublicSiteSnapshot Snapshot(PublicSiteDto site, DateTimeOffset lastChangedUtc)
    {
        var json = JsonSerializer.Serialize(site, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        return new PublicSiteSnapshot(site, new PublicJsonSnapshot(json, etag, lastChangedUtc));
    }

    public ValueTask<PublicSiteSnapshot> GetSiteAsync(CancellationToken cancellationToken) =>
        _failure is not null ? throw _failure : ValueTask.FromResult(_snapshot!);

    /// <summary>The product lines the stub returns; none by default.</summary>
    public PublicProductLinesDto ProductLines { get; set; } = new([]);

    /// <summary>When set, only the product lines read throws it; the site read still works.</summary>
    public Exception? LinesFailure { get; set; }

    public ValueTask<PublicProductLinesSnapshot> GetProductLinesAsync(CancellationToken cancellationToken) =>
        (_failure ?? LinesFailure) is { } failure ? throw failure : ValueTask.FromResult(Lines(ProductLines));

    /// <summary>The Home data the stub returns; empty by default.</summary>
    public PublicHomeDto Home { get; set; } = new([], 0, [], [], null);

    /// <summary>When set, only the Home read throws it; the site read still works.</summary>
    public Exception? HomeFailure { get; set; }

    public ValueTask<PublicHomeSnapshot> GetHomeAsync(CancellationToken cancellationToken) =>
        (_failure ?? HomeFailure) is { } failure ? throw failure : ValueTask.FromResult(HomeSnapshot(Home));

    /// <summary>The Gallery data the stub returns; empty by default.</summary>
    public PublicGalleryDto Gallery { get; set; } = new([], [], 0);

    /// <summary>The link preview address the stub gives the Gallery; none by default.</summary>
    public string? GalleryShareImageUrl { get; set; }

    /// <summary>When set, only the Gallery read throws it; the site read still works.</summary>
    public Exception? GalleryFailure { get; set; }

    public ValueTask<PublicGallerySnapshot> GetGalleryAsync(CancellationToken cancellationToken)
    {
        if ((_failure ?? GalleryFailure) is { } failure)
        {
            throw failure;
        }

        var json = JsonSerializer.Serialize(Gallery, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        return ValueTask.FromResult(new PublicGallerySnapshot(Gallery, new PublicJsonSnapshot(json, etag, new DateTimeOffset(2026, 11, 10, 0, 0, 0, TimeSpan.Zero)), GalleryShareImageUrl));
    }

    public static PublicHomeSnapshot HomeSnapshot(PublicHomeDto home)
    {
        var json = JsonSerializer.Serialize(home, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        return new PublicHomeSnapshot(home, new PublicJsonSnapshot(json, etag, new DateTimeOffset(2026, 11, 10, 0, 0, 0, TimeSpan.Zero)));
    }

    public static PublicProductLinesSnapshot Lines(PublicProductLinesDto lines)
    {
        var json = JsonSerializer.Serialize(lines, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        return new PublicProductLinesSnapshot(lines, new PublicJsonSnapshot(json, etag, new DateTimeOffset(2026, 11, 10, 0, 0, 0, TimeSpan.Zero)));
    }
}
