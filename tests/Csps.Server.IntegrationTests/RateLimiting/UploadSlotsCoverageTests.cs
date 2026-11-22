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
        using var taken = await slots.AcquireAsync(1, TestContext.Current.CancellationToken);
        var reached = false;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });
        var context = ContextFor(new EndpointNameMetadata("CreateGalleryUpload"), new UploadSlotAttribute());

        await middleware.InvokeAsync(context, slots);

        taken.IsAcquired.ShouldBeTrue();
        reached.ShouldBeFalse();
        context.Response.StatusCode.ShouldBe(StatusCodes.Status429TooManyRequests);
    }

    [Fact]
    public async Task AnEndpointWithoutTheSlotMetadataPassesThroughEvenWhenTheCapIsFull()
    {
        using var slots = new ConcurrencyLimiter(new ConcurrencyLimiterOptions { PermitLimit = 1, QueueLimit = 0 });
        using var taken = await slots.AcquireAsync(1, TestContext.Current.CancellationToken);
        var reached = false;
        var middleware = new UploadSlotsMiddleware(_ =>
        {
            reached = true;
            return Task.CompletedTask;
        });
        var context = ContextFor(new EndpointNameMetadata("UploadOrderImage"));

        await middleware.InvokeAsync(context, slots);

        taken.IsAcquired.ShouldBeTrue();
        reached.ShouldBeTrue();
    }

    private static DefaultHttpContext ContextFor(params object[] metadata)
    {
        var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        context.SetEndpoint(new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(metadata), "test"));
        return context;
    }
}
