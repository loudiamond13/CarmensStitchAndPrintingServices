#if CSPS_TESTING
using System.Reflection;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Csps.Server.Testing;

/// <summary>
/// Removes every <see cref="TestingOnlyAttribute"/> controller from the application parts unless the host runs in the
/// Testing environment, so outside it the routes are never mapped (404 from the API fallback).
/// </summary>
/// <param name="keepTestingControllers">True only in the Testing environment.</param>
public sealed class TestingControllersFeatureProvider(bool keepTestingControllers) : IApplicationFeatureProvider<ControllerFeature>
{
    /// <inheritdoc />
    public void PopulateFeature(IEnumerable<ApplicationPart> parts, ControllerFeature feature)
    {
        ArgumentNullException.ThrowIfNull(feature);

        if (keepTestingControllers)
        {
            return;
        }

        foreach (var controller in feature.Controllers.Where(static type => type.IsDefined(typeof(TestingOnlyAttribute), inherit: false)).ToList())
        {
            feature.Controllers.Remove(controller);
        }
    }
}
#endif
