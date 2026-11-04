using System.Globalization;
using System.Net;
using System.Text;
using Csps.Infrastructure.Images;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>
/// IMG-04, D-03, D-33: the one-time setup command lists, creates and reports the 13 named sizes, and never changes an existing
/// one. Everything runs against the stub (no network, D-07); keys and names are fake.
/// </summary>
public sealed class CloudinarySetupCommandTests
{
    private const string FakeSecret = "test-secret-not-real";
    private const string FakeKey = "000000000000000";
    private const string FakeCloud = "demo-cloud";
    private const string ConfigureMessage = "Set Cloudinary:CloudName, Cloudinary:ApiKey and Cloudinary:ApiSecret first.";

    private static readonly string[] ThreeMissing = ["csps_card_960", "csps_view_1600", "csps_full_2000"];

    private static readonly Dictionary<string, string> LongNames = new(StringComparer.Ordinal)
    {
        ["c"] = "crop",
        ["g"] = "gravity",
        ["w"] = "width",
        ["h"] = "height",
        ["q"] = "quality",
        ["f"] = "fetch_format",
    };

    private static (CloudinarySetupCommand Command, StubCloudinaryHandler Handler) Build(CloudinarySettings? settings = null)
    {
        var handler = new StubCloudinaryHandler();
        var given = settings ?? new CloudinarySettings { CloudName = FakeCloud, ApiKey = FakeKey, ApiSecret = FakeSecret, RootFolder = "csps-dev" };
        return (new CloudinarySetupCommand(given, new StubHttpClientFactory(handler)), handler);
    }

    // The way the Admin API describes a named size: one object per "/" part, long key names.
    private static string InfoJson(string transformation, int widthShift = 0)
    {
        var parts = transformation.Split('/').Select(part =>
        {
            var fields = part.Split(',').Select(pair =>
            {
                var key = LongNames[pair[..pair.IndexOf('_', StringComparison.Ordinal)]];
                var value = pair[(pair.IndexOf('_', StringComparison.Ordinal) + 1)..];
                if (key == "width")
                {
                    value = (int.Parse(value, CultureInfo.InvariantCulture) + widthShift).ToString(CultureInfo.InvariantCulture);
                }

                return key is "width" or "height" ? $"\"{key}\":{value}" : $"\"{key}\":\"{value}\"";
            });
            return "{" + string.Join(',', fields) + "}";
        });
        return "[" + string.Join(',', parts) + "]";
    }

    private static string ListJson(IEnumerable<string> names, string? nextCursor = null)
    {
        var items = string.Join(',', names.Select(name => $"{{\"name\":\"{name}\",\"allowed_for_strict\":true,\"used\":false,\"named\":true}}"));
        return $"{{\"transformations\":[{items}]{(nextCursor is null ? string.Empty : $",\"next_cursor\":\"{nextCursor}\"")}}}";
    }

    private static string DetailJson(ImageNamedSize size, int widthShift = 0, string allowed = "true") =>
        $"{{\"name\":\"{size.Name}\",\"allowed_for_strict\":{allowed},\"used\":false,\"named\":true,\"info\":{InfoJson(size.Transformation, widthShift)},\"derived\":[]}}";

    // Queues the list answer and one detail answer per existing size, in catalog order.
    private static void QueueExisting(StubCloudinaryHandler handler, IReadOnlyCollection<string> missing, string? differentName = null, string allowed = "true")
    {
        var existing = ImageNamedSizes.All.Where(size => !missing.Contains(size.Name)).ToList();
        handler.Reply(HttpStatusCode.OK, ListJson(existing.Select(size => size.Name)));
        foreach (var size in existing)
        {
            handler.Reply(HttpStatusCode.OK, DetailJson(size, size.Name == differentName ? 1 : 0, size.Name == differentName ? allowed : "true"));
        }
    }

    private static async Task<(int Exit, string Output)> RunAsync(CloudinarySetupCommand command, bool checkOnly)
    {
        var output = new StringWriter(new StringBuilder());
        var exit = await command.RunAsync(checkOnly, output, TestContext.Current.CancellationToken);
        return (exit, output.ToString());
    }

    [Fact]
    public async Task CheckOnlyListsWhatExistsAndWhatIsMissingAndMakesNoChange()
    {
        var (command, handler) = Build();
        QueueExisting(handler, ThreeMissing);

        var (exit, output) = await RunAsync(command, checkOnly: true);

        exit.ShouldBe(0);
        output.ShouldContain("10 exist, 3 missing");
        output.ShouldContain("csps_sq_44: exists");
        foreach (var name in ThreeMissing)
        {
            output.ShouldContain($"{name}: missing");
        }

        handler.Requests.Count.ShouldBe(11);
        handler.Requests.ShouldAllBe(request => request.Method == HttpMethod.Get);
    }

    [Fact]
    public async Task CreatingMakesExactlyTheMissingSizesAllowedForStrictModeAndNothingElse()
    {
        var (command, handler) = Build();
        QueueExisting(handler, ThreeMissing);
        for (var i = 0; i < ThreeMissing.Length; i++)
        {
            handler.Reply(HttpStatusCode.OK, """{"message":"created"}""");
            handler.Reply(HttpStatusCode.OK, """{"message":"updated"}""");
        }

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(0);
        output.ShouldContain("3 created");
        foreach (var name in ThreeMissing)
        {
            output.ShouldContain($"{name}: created");
        }

        var creates = handler.Requests.Where(request => request.Method == HttpMethod.Post).ToList();
        creates.Select(request => request.Fields["name"]).ShouldBe(ThreeMissing);
        creates.Select(request => request.Fields["transformation"]).ShouldBe(ThreeMissing.Select(name => ImageNamedSizes.All.Single(size => size.Name == name).Transformation));

        var allowed = handler.Requests.Where(request => request.Method == HttpMethod.Put).ToList();
        allowed.Count.ShouldBe(3);
        allowed.ShouldAllBe(request => request.Fields["allowed_for_strict"] == "true");
        allowed.Select(request => request.Fields["transformation"]).ShouldBe(ThreeMissing);
        handler.Requests.ShouldNotContain(request => request.Method == HttpMethod.Delete);
    }

    [Fact]
    public async Task ARunWithNothingMissingCreatesNothingAndSaysAllThirteenExist()
    {
        var (command, handler) = Build();
        QueueExisting(handler, []);

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(0);
        output.ShouldContain("13 exist");
        output.ShouldNotContain("created");
        handler.Requests.ShouldAllBe(request => request.Method == HttpMethod.Get);
    }

    [Fact]
    public async Task ASizeWithADifferentDefinitionIsReportedAndNeverChanged()
    {
        var (command, handler) = Build();
        QueueExisting(handler, [], differentName: "csps_sq_44");

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(1);
        output.ShouldContain("csps_sq_44: different");
        output.ShouldContain("12 exist, 1 different");
        handler.Requests.ShouldAllBe(request => request.Method == HttpMethod.Get);
    }

    [Fact]
    public async Task ADifferentSizeStillLetsTheMissingOnesBeCreatedButIsNeverTouched()
    {
        var (command, handler) = Build();
        QueueExisting(handler, ["csps_view_960", "csps_view_1280"], differentName: "csps_card_320");
        for (var i = 0; i < 2; i++)
        {
            handler.Reply(HttpStatusCode.OK, """{"message":"created"}""");
            handler.Reply(HttpStatusCode.OK, """{"message":"updated"}""");
        }

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(1);
        output.ShouldContain("csps_card_320: different");
        output.ShouldContain("2 created");
        handler.Requests.Where(request => request.Method != HttpMethod.Get).SelectMany(request => request.Fields.Values)
            .ShouldNotContain("csps_card_320");
        handler.Requests.ShouldNotContain(request => request.Method == HttpMethod.Delete);
    }

    [Fact]
    public async Task ASizeNotAllowedForStrictModeIsReportedAsDifferentAndNotChanged()
    {
        var (command, handler) = Build();
        QueueExisting(handler, [], differentName: "csps_full_2000", allowed: "false");
        var (exit, output) = await RunAsync(command, checkOnly: true);

        exit.ShouldBe(1);
        output.ShouldContain("csps_full_2000: different");
    }

    [Fact]
    public async Task NamesWithATPrefixInTheListStillCountAsExisting()
    {
        var (command, handler) = Build();
        handler.Reply(HttpStatusCode.OK, ListJson(ImageNamedSizes.All.Select(size => "t_" + size.Name)));
        foreach (var size in ImageNamedSizes.All)
        {
            handler.Reply(HttpStatusCode.OK, DetailJson(size));
        }

        var (exit, output) = await RunAsync(command, checkOnly: true);

        exit.ShouldBe(0);
        output.ShouldContain("13 exist");
    }

    [Fact]
    public async Task AListThatContinuesOnAnotherPageIsReadToTheEnd()
    {
        var (command, handler) = Build();
        var half = ImageNamedSizes.All.Count / 2;
        handler.Reply(HttpStatusCode.OK, ListJson(ImageNamedSizes.All.Take(half).Select(size => size.Name), "cursor-two"));
        handler.Reply(HttpStatusCode.OK, ListJson(ImageNamedSizes.All.Skip(half).Select(size => size.Name)));
        foreach (var size in ImageNamedSizes.All)
        {
            handler.Reply(HttpStatusCode.OK, DetailJson(size));
        }

        var (exit, output) = await RunAsync(command, checkOnly: true);

        exit.ShouldBe(0);
        output.ShouldContain("13 exist");
        handler.Requests[1].Uri.Query.ShouldContain("cursor-two");
    }

    [Fact]
    public async Task MissingKeysStopTheRunWithTheSetupMessageAndMakeNoCall()
    {
        var (command, handler) = Build(new CloudinarySettings { CloudName = FakeCloud, ApiKey = FakeKey });

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(2);
        output.Trim().ShouldBe(ConfigureMessage);
        handler.Requests.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheOutputNeverShowsTheCloudNameTheKeyOrTheSecret()
    {
        var (command, handler) = Build();
        QueueExisting(handler, ThreeMissing);

        var (_, output) = await RunAsync(command, checkOnly: true);

        output.ShouldNotContain(FakeCloud);
        output.ShouldNotContain(FakeKey);
        output.ShouldNotContain(FakeSecret);
    }

    [Fact]
    public async Task RefusedKeysEndTheRunWithAShortMessageAndNoSecret()
    {
        var (command, handler) = Build();
        handler.Reply(HttpStatusCode.Unauthorized, """{"error":{"message":"Invalid api_key 000000000000000"}}""");

        var (exit, output) = await RunAsync(command, checkOnly: false);

        exit.ShouldBe(3);
        output.ShouldContain("Cloudinary refused the keys.");
        output.ShouldNotContain(FakeKey);
        output.ShouldNotContain(FakeCloud);
        handler.Requests.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task ABusyCloudinaryEndsTheRunWithATryLaterMessage()
    {
        var (command, handler) = Build();
        handler.Reply((HttpStatusCode)420, """{"error":{"message":"Rate limit"}}""");

        var (exit, output) = await RunAsync(command, checkOnly: true);

        exit.ShouldBe(3);
        output.ShouldContain("Cloudinary is busy or did not answer. Try again later.");
    }

    [Theory]
    [InlineData("--check", true)]
    [InlineData("", false)]
    public void TheCheckFlagMapsToCheckOnly(string argument, bool expected)
    {
        string[] args = argument.Length == 0 ? [] : [argument];

        CloudinarySetupCommand.TryReadArguments(args, out var checkOnly).ShouldBeTrue();

        checkOnly.ShouldBe(expected);
    }

    [Theory]
    [InlineData("--create")]
    [InlineData("check")]
    public void AnyOtherArgumentIsRefused(string argument)
    {
        CloudinarySetupCommand.TryReadArguments([argument], out _).ShouldBeFalse();
    }
}
