using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>Checks the Change Status action.</summary>
public sealed class ChangeQuoteRequestStatusRequestValidator : AbstractValidator<ChangeQuoteRequestStatusRequest>;
