using System.Globalization;

namespace Csps.Application.Common;

/// <summary>The one way a handler turns an id into the target id of an audit entry.</summary>
public static class AuditKey
{
    /// <summary>Formats an id as lower-case <c>D</c> text, the same on every machine.</summary>
    /// <param name="id">The id of the thing acted on.</param>
    /// <returns>The id as 36 characters with dashes.</returns>
    public static string Of(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);
}
