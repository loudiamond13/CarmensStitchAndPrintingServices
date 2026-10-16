using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Csps.Testing;

/// <summary>
/// Sets the connection's remote address from a request header, because the in-memory test server has none. It is never
/// registered by default: a test host opts in with <c>services.AddSingleton&lt;IStartupFilter, RemoteIpStartupFilter&gt;()</c>.
/// A missing or unparsable header leaves the address unset.
/// </summary>
public sealed class RemoteIpStartupFilter : IStartupFilter
{
    /// <summary>The request header that carries the address to use.</summary>
    public const string HeaderName = "X-Test-Remote-Ip";

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        ArgumentNullException.ThrowIfNull(next);
        return app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                if (context.Request.Headers.TryGetValue(HeaderName, out var value) && IPAddress.TryParse(value.ToString(), out var address))
                {
                    context.Connection.RemoteIpAddress = address;
                }

                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
