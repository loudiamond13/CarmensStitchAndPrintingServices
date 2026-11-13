using Csps.Application.Content;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the public site content use cases: one handler class per use case, no mediator.</summary>
public static class ContentApplicationRegistration
{
    /// <summary>Adds the public content handlers as scoped services and their form rules as singletons.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsContentHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<GetPublicSiteHandler>();
        services.AddScoped<UpdateSiteSettingsHandler>();
        services.AddSingleton<IValidator<UpdateSiteSettingsRequest>, UpdateSiteSettingsRequestValidator>();
        services.AddScoped<GetPublicProductLinesHandler>();
        services.AddScoped<GetOpenStatusHandler>();
        services.AddScoped<GetOpeningHoursHandler>();
        services.AddScoped<UpdateOpeningHoursHandler>();
        services.AddSingleton<IValidator<UpdateOpeningHoursRequest>, UpdateOpeningHoursRequestValidator>();
        services.AddScoped<ListShopClosuresHandler>();
        services.AddScoped<CreateShopClosureHandler>();
        services.AddScoped<UpdateShopClosureHandler>();
        services.AddScoped<DeleteShopClosureHandler>();
        services.AddSingleton<IValidator<ShopClosureRequest>, ShopClosureRequestValidator>();
        services.AddScoped<ListProductLinesHandler>();
        services.AddScoped<ListProductLineOptionsHandler>();
        services.AddScoped<GetProductLineHandler>();
        services.AddScoped<CreateProductLineHandler>();
        services.AddScoped<UpdateProductLineHandler>();
        services.AddScoped<MoveProductLineHandler>();
        services.AddScoped<SetProductLineShownHandler>();
        services.AddScoped<DeleteProductLineHandler>();
        services.AddScoped<UploadProductLinePhotoHandler>();
        services.AddScoped<RemoveProductLinePhotoHandler>();
        services.AddSingleton<IValidator<ProductLineRequest>, ProductLineRequestValidator>();
        services.AddSingleton<IValidator<MoveProductLineRequest>, MoveProductLineRequestValidator>();
        services.AddScoped<GetPublicHomeHandler>();
        services.AddScoped<GetPublicGalleryHandler>();
        services.AddScoped<ListTestimonialsHandler>();
        services.AddScoped<CreateTestimonialHandler>();
        services.AddScoped<UpdateTestimonialHandler>();
        services.AddScoped<MoveTestimonialHandler>();
        services.AddScoped<SetTestimonialShownHandler>();
        services.AddScoped<DeleteTestimonialHandler>();
        services.AddSingleton<IValidator<TestimonialRequest>, TestimonialRequestValidator>();
        services.AddSingleton<IValidator<MoveTestimonialRequest>, MoveTestimonialRequestValidator>();
        services.AddScoped<ListGalleryItemsHandler>();
        services.AddScoped<CreateGalleryUploadHandler>();
        services.AddSingleton<IValidator<ListGalleryItemsRequest>, ListGalleryItemsRequestValidator>();
        services.AddSingleton<IValidator<GalleryUploadRequest>, GalleryUploadRequestValidator>();
        return services;
    }
}
