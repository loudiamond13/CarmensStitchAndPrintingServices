using Csps.Domain.Common;
using Csps.Server.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Csps.Server.Security;

/// <summary>
/// Guards the maintenance run (JOB-01): the call must carry <c>X-Maintenance-Key</c> equal to the configured <c>Maintenance:Key</c>.
/// A missing, wrong or unset key is a 401 <c>maintenance.key</c> and the action never runs.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class RequireMaintenanceKeyAttribute : Attribute, IAsyncAuthorizationFilter
{
    /// <inheritdoc />
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var configured = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>()[MaintenanceKey.ConfigurationKey];
        var provided = context.HttpContext.Request.Headers[MaintenanceKey.HeaderName].ToString();
        if (MaintenanceKey.Matches(provided.Length == 0 ? null : provided, configured))
        {
            return;
        }

        var refusal = Result.Failure(MaintenanceKey.Refused).ToHttpResult(context.HttpContext, static () => Results.NoContent());
        await refusal.ExecuteAsync(context.HttpContext).ConfigureAwait(false);
        context.Result = new EmptyResult();
    }
}
