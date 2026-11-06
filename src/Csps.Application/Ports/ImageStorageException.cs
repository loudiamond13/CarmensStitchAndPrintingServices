namespace Csps.Application.Ports;

/// <summary>
/// The image storage could not list its files or read its usage. Uploads and removals report this as an outcome instead; listing
/// and usage have no outcome to carry it, so the job that asked catches this and writes a plain line in its run summary.
/// </summary>
public sealed class ImageStorageException : Exception
{
    /// <summary>Initializes a new instance of the <see cref="ImageStorageException"/> class.</summary>
    /// <param name="failureCode">A short code naming the cause, such as <c>transient</c> or <c>unauthorized</c>; never an address or a key.</param>
    public ImageStorageException(string failureCode)
        : base($"The image storage could not be read: {failureCode}.")
    {
        FailureCode = failureCode;
    }

    /// <summary>Gets the short code naming the cause.</summary>
    public string FailureCode { get; }
}
