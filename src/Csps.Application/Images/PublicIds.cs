namespace Csps.Application.Images;

/// <summary>Makes the random ids order photos are stored under (IMG-03, D-01).</summary>
public static class PublicIds
{
    /// <summary>Gets the storage folder of an order's photos.</summary>
    /// <param name="root">The environment's root folder, such as <c>csps</c>.</param>
    /// <param name="orderId">The order id.</param>
    /// <returns>The folder, without a trailing slash.</returns>
    public static string Folder(string root, Guid orderId) => string.Empty;

    /// <summary>Makes a new random public id inside the order's folder.</summary>
    /// <param name="root">The environment's root folder.</param>
    /// <param name="orderId">The order id.</param>
    /// <returns>The public id.</returns>
    public static string New(string root, Guid orderId) => string.Empty;
}
