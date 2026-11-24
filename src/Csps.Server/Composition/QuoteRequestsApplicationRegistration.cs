using Csps.Application.QuoteRequests;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the quote request use cases: one handler class per use case, no mediator.</summary>
public static class QuoteRequestsApplicationRegistration
{
    /// <summary>Adds the quote request handlers and validators.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsQuoteRequestHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IValidator<CreateQuoteRequestRequest>, CreateQuoteRequestRequestValidator>();
        services.AddScoped<CreateQuoteRequestHandler>();
        services.AddScoped<UploadQuotePhotoHandler>();
        services.AddScoped<GetQuoteFormTicketHandler>();
        services.AddSingleton<IValidator<ListQuoteRequestsRequest>, ListQuoteRequestsRequestValidator>();
        services.AddScoped<ListQuoteRequestsHandler>();
        services.AddScoped<GetNewQuoteCountHandler>();
        services.AddScoped<GetQuoteRequestHandler>();
        services.AddSingleton<IValidator<ChangeQuoteRequestStatusRequest>, ChangeQuoteRequestStatusRequestValidator>();
        services.AddScoped<ChangeQuoteRequestStatusHandler>();
        services.AddSingleton<IValidator<AddQuoteRequestNoteRequest>, AddQuoteRequestNoteRequestValidator>();
        services.AddScoped<AddQuoteRequestNoteHandler>();
        services.AddScoped<DeleteQuoteRequestHandler>();
        services.AddScoped<GetOrderPrefillHandler>();
        return services;
    }
}
