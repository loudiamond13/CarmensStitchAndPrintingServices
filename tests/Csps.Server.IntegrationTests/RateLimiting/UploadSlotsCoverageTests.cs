using System.Reflection;
using System.Threading.RateLimiting;
using Csps.Server.Controllers;
using Csps.Server.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// T-09-27: the cap of two photo uploads at a time covers every upload endpoint, found by endpoint metadata and not by one name.
/// </summary>
public sealed class UploadSlotsCoverageTests
{
    [Fact]
    public void EveryActionThatTakesAFileCarriesBothTheImageUploadRateLimitAndTheUploadSlot()
    {
        var uploadActions = typeof(OrderImagesController).Assembly.GetTypes()
            .Where(type => typeof(ControllerBase).IsAssignableFrom(type))
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
            .Where(method => method.GetParameters().Any(parameter => CarriesFile(parameter.ParameterType, [])))
            .ToList();

        uploadActions.Count.ShouldBe(6, "the order photo, the gallery upload and replace, the product line photo, the share picture and the quote photo");
        uploadActions.Where(method => !Has<EnableRateLimitingAttribute>(method, attribute => attribute.PolicyName == RateLimitPolicies.ImageUpload))
            .Select(Name)
            .ShouldBeEmpty("every file upload action carries the image upload rate limit");
        uploadActions.Where(method => !Has<UploadSlotAttribute>(method, _ => true))
            .Select(Name)
            .ShouldBeEmpty("every file upload action takes a slot");
    }

    // A file can arrive directly, in a list or array, or as a property of a form model (only our own types are walked).
    private static bool CarriesFile(Type type, HashSet<Type> seen)
    {
        if (type == typeof(IFormFile) || type == typeof(IFormFileCollection))
        {
            return true;
        }

        if (type.IsPrimitive || type == typeof(string) || !seen.Add(type))
        {
            return false;
        }

        if (type.HasElementType && CarriesFile(type.GetElementType()!, seen))
        {
            return true;
        }

        if (type.IsGenericType && type.GetGenericArguments().Any(argument => CarriesFile(argument, seen)))
        {
            return true;
        }

        return type.Namespace?.StartsWith("Csps", StringComparison.Ordinal) == true
            && type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Any(property => CarriesFile(property.PropertyType, seen));
    }

    [Theory]
    [InlineData(typeof(IFormFile), true)]
    [InlineData(typeof(IFormFileCollection), true)]
    [InlineData(typeof(IFormFile[]), true)]
    [InlineData(typeof(List<IFormFile>), true)]
    [InlineData(typeof(IEnumerable<IFormFile>), true)]
    [InlineData(typeof(SampleUploadModel), true)]
    [InlineData(typeof(SampleBatchModel), true)]
    [InlineData(typeof(SampleLoopModel), false)]
    [InlineData(typeof(string), false)]
    [InlineData(typeof(int), false)]
    [InlineData(typeof(CancellationToken), false)]
    [InlineData(typeof(List<string>), false)]
    public void TheFileFinderSeesAFileHoweverItIsCarried(Type type, bool expected) =>
        CarriesFile(type, []).ShouldBe(expected);

    private sealed class SampleUploadModel
    {
        public IFormFile? Photo { get; init; }
    }

    private sealed class SampleBatchModel
    {
        public List<IFormFile> Photos { get; init; } = [];
    }

    private sealed class SampleLoopModel
    {
        public SampleLoopModel? Next { get; init; }

        public string? Name { get; init; }
    }

    private static string Name(MethodInfo method) => $"{method.DeclaringType!.Name}.{method.Name}";

    // The attribute may sit on the action or on its controller class.
    private static bool Has<T>(MethodInfo method, Func<T, bool> matches)
        where T : Attribute =>
        method.GetCustomAttributes<T>(inherit: true).Concat(method.DeclaringType!.GetCustomAttributes<T>(inherit: true)).Any(matches);

    [Fact]
    public async Task AnEndpointWithTheSlotMetadataIsHeldToTheCapWhateverItsName()
    {
        using var slots = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 });
        using var publicSlots = NewPublicSlots();
        using var taken = await slots.AcquireAsync(1, TestContext.Current.CancellationToken);
        var reached = false;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });
        var context = ContextFor(new EndpointNameMetadata("CreateGalleryUpload"), new UploadSlotAttribute());

        await middleware.InvokeAsync(context, slots, publicSlots);

        taken.IsAcquired.ShouldBeTrue();
        reached.ShouldBeFalse();
        context.Response.StatusCode.ShouldBe(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task AnEndpointWithoutTheSlotMetadataPassesThroughEvenWhenTheCapIsFull()
    {
        using var slots = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 });
        using var publicSlots = NewPublicSlots();
        using var taken = await slots.AcquireAsync(1, TestContext.Current.CancellationToken);
        var reached = false;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });
        var context = ContextFor(new EndpointNameMetadata("UploadOrderImage"));

        await middleware.InvokeAsync(context, slots, publicSlots);

        taken.IsAcquired.ShouldBeTrue();
        reached.ShouldBeTrue();
    }

    [Fact]
    public async Task AFullPublicPoolRefusesAPublicUploadButNeverAStaffUpload()
    {
        using var staff = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 });
        using var publicSlots = NewPublicSlots(atOnce: 1, waiting: 0);
        using var publicTaken = await publicSlots.Limiter.AcquireAsync(1, TestContext.Current.CancellationToken);
        var reached = 0;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached++;
            return Task.CompletedTask;
        });
        var publicContext = ContextFor(new UploadSlotAttribute { Pool = UploadSlotPool.Public });
        var staffContext = ContextFor(new UploadSlotAttribute());

        await middleware.InvokeAsync(publicContext, staff, publicSlots);
        await middleware.InvokeAsync(staffContext, staff, publicSlots);

        publicContext.Response.StatusCode.ShouldBe(StatusCodes.Status429TooManyRequests);
        staffContext.Response.StatusCode.ShouldBe(StatusCodes.Status200OK);
        reached.ShouldBe(1, "only the staff upload went on");
    }

    [Fact]
    public async Task AFullStaffPoolNeverRefusesAPublicUpload()
    {
        using var staff = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 });
        using var staffTaken = await staff.AcquireAsync(1, TestContext.Current.CancellationToken);
        using var publicSlots = NewPublicSlots();
        var reached = false;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });
        var context = ContextFor(new UploadSlotAttribute { Pool = UploadSlotPool.Public });

        await middleware.InvokeAsync(context, staff, publicSlots);

        reached.ShouldBeTrue();
        context.Response.StatusCode.ShouldBe(StatusCodes.Status200OK);
    }

    [Fact]
    public async Task APublicUploadHoldsAPublicSlotAndNoStaffSlot()
    {
        using var staff = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 2, QueueLimit = 0 });
        using var publicSlots = NewPublicSlots();
        long? staffFree = null;
        long? publicFree = null;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            staffFree = staff.GetStatistics()!.CurrentAvailablePermits;
            publicFree = publicSlots.Limiter.GetStatistics()!.CurrentAvailablePermits;
            return Task.CompletedTask;
        });

        await middleware.InvokeAsync(ContextFor(new UploadSlotAttribute { Pool = UploadSlotPool.Public }), staff, publicSlots);

        staffFree.ShouldBe(2);
        publicFree.ShouldBe(1);
        publicSlots.Limiter.GetStatistics()!.CurrentAvailablePermits.ShouldBe(2, "the public slot is given back");
    }

    [Fact]
    public void OnlyTheAnonymousQuotePhotoActionUsesThePublicPool()
    {
        var publicActions = typeof(OrderImagesController).Assembly.GetTypes()
            .Where(type => typeof(ControllerBase).IsAssignableFrom(type))
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
            .Where(method => method.GetCustomAttributes<UploadSlotAttribute>(inherit: true).Any(attribute => attribute.Pool == UploadSlotPool.Public))
            .Select(Name)
            .ToList();

        publicActions.ShouldBe([$"{nameof(PublicQuoteRequestsController)}.{nameof(PublicQuoteRequestsController.UploadPhoto)}"]);
    }

    [Fact]
    public void ThePublicPoolDefaultsToTwoAtOnceWithFourWaitingAndItsSettingsAreChecked()
    {
        var rule = PublicUploadSlotRule.Default();

        (rule.AtOnce, rule.Waiting).ShouldBe((2, 4));
        PublicUploadSlotRule.SectionName.ShouldBe("UploadSlots:Public");
        PublicUploadSlotRule.Problems(rule).ShouldBeEmpty();
        PublicUploadSlotRule.Problems(new PublicUploadSlotRule { AtOnce = 0, Waiting = 21 })
            .ShouldBe(["UploadSlots:Public:AtOnce must be from 1 to 8.", "UploadSlots:Public:Waiting must be from 0 to 20."]);
        PublicUploadSlotRule.Problems(new PublicUploadSlotRule { AtOnce = 8, Waiting = 0 }).ShouldBeEmpty();
        PublicUploadSlotRule.Problems(null).Count.ShouldBe(2);
    }

    private static PublicUploadSlots NewPublicSlots(int atOnce = 2, int waiting = 4) =>
        PublicUploadSlots.Create(new PublicUploadSlotRule { AtOnce = atOnce, Waiting = waiting });

    private static DefaultHttpContext ContextFor(params object[] metadata)
    {
        var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        context.SetEndpoint(new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(metadata), "test"));
        return context;
    }
}
