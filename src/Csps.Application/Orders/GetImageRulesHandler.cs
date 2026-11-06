using Csps.Application.Auth;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>Use case: signed-in staff read the photo rules, so the browser checks the same limits the upload enforces (OR-3, IMG-02).</summary>
/// <param name="settings">The configured upload limits.</param>
/// <param name="requestContext">The signed-in caller.</param>
public sealed class GetImageRulesHandler(ImageUploadSettings settings, IRequestContext requestContext)
{
    private static readonly string[] Types = [.. Enum.GetValues<ImageKind>().Select(static kind => kind.ToString().ToLowerInvariant())];

    /// <summary>Reads the rules.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The rules, or a 401 when the token names no usable account.</returns>
    public Task<Result<ImageRulesResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var result = requestContext.UserId is null
            ? Result.Failure<ImageRulesResponse>(AuthErrors.SessionEnded)
            : Result.Success(new ImageRulesResponse(OrderImageRules.MaxImagesPerOrder, settings.MaxBytes, settings.MaxPixels, settings.MaxSide, Types, OrderImageRules.DescriptionMaxLength));
        return Task.FromResult(result);
    }
}
