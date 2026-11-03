using Csps.Domain.Common;

namespace Csps.Application.Images;

/// <summary>The expected failures of a photo upload (IMG-01, IMG-02), each with its machine code and a plain-English message.</summary>
public static class ImageErrors
{
    /// <summary>The field the file errors are reported on.</summary>
    public const string FileField = "file";

    /// <summary>The machine code of a file that is not a photo we can use.</summary>
    public const string TypeCode = "images.type";

    /// <summary>The machine code of an upload with no file.</summary>
    public const string FileMissingCode = "images.file-missing";

    /// <summary>The machine code of an upload when no image storage is set up.</summary>
    public const string NotConfiguredCode = "images.not-configured";

    /// <summary>The machine code of a storage that did not take the file.</summary>
    public const string StorageFailedCode = "images.storage-failed";

    /// <summary>The message for an upload with no file.</summary>
    public const string FileMissingMessage = "Choose a photo to upload.";

    /// <summary>The message for an upload when no image storage is set up.</summary>
    public const string NotConfiguredMessage = "Photo uploads aren't set up yet.";

    /// <summary>The message for a storage that did not take the file.</summary>
    public const string StorageFailedMessage = "The photo couldn't be saved. Try again.";

    private const int FileNameLimit = 80;

    /// <summary>Gets the error for an upload with no file.</summary>
    public static Error FileMissing { get; } = Error.Validation(FileMissingCode, FileMissingMessage, FieldErrors(FileMissingMessage));

    /// <summary>Gets the error for an upload when no image storage is set up.</summary>
    public static Error NotConfigured { get; } = Error.Unavailable(NotConfiguredCode, NotConfiguredMessage);

    /// <summary>Gets the error for a storage that did not take the file.</summary>
    public static Error StorageFailed { get; } = Error.Unavailable(StorageFailedCode, StorageFailedMessage);

    /// <summary>Builds the error for a file whose first bytes are not a JPG, PNG, WEBP or HEIC photo.</summary>
    /// <param name="fileName">The name the client sent; only shown in the message, never trusted for anything else.</param>
    /// <returns>A validation error on the <c>file</c> field.</returns>
    public static Error Type(string? fileName)
    {
        var message = $"{CleanName(fileName)} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.";
        return Error.Validation(TypeCode, message, FieldErrors(message));
    }

    /// <summary>Cleans a client file name for a message: no folders, no control characters, at most 80 characters.</summary>
    /// <param name="fileName">The name as sent.</param>
    /// <returns>The cleaned name, or <c>This file</c> when nothing is left.</returns>
    public static string CleanName(string? fileName)
    {
        var name = fileName ?? string.Empty;
        var cut = name.LastIndexOfAny(['/', '\\']);
        var leaf = cut >= 0 ? name[(cut + 1)..] : name;
        var cleaned = new string([.. leaf.Where(static character => !char.IsControl(character))]).Trim();
        if (cleaned.Length > FileNameLimit)
        {
            cleaned = cleaned[..FileNameLimit];
        }

        return cleaned.Length == 0 ? "This file" : cleaned;
    }

    private static Dictionary<string, string[]> FieldErrors(string message) => new() { [FileField] = [message] };
}
