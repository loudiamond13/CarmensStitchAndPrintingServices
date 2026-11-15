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
            .Where(method => method.GetParameters().Any(parameter => parameter.ParameterType == typeof(IFormFile) || parameter.ParameterType == typeof(IFormFileCollection)))
            .ToList();

        uploadActions.Count.ShouldBe(5, "the order photo, the gallery upload and replace, the product line photo and the share picture");
        uploadActions.Where(method => !Has<EnableRateLimitingAttribute>(method, attribute => attribute.PolicyName == RateLimitPolicies.ImageUpload))
            .Select(Name)
            .ShouldBeEmpty("every file upload action carries the image upload rate limit");
        uploadActions.Where(method => !Has<UploadSlotAttribute>(method, _ => true))
            .Select(Name)
            .ShouldBeEmpty("every file upload action takes a slot");
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
