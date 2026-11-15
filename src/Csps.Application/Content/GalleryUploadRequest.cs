using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The fields of the gallery upload form (GAL-03, SEC-07), for adding (sent as form parts next to the photo) and for editing (sent as JSON).
/// Any other member is ignored: who added the upload and when come from the server (SEC-08).
/// </summary>
/// <param name="TeamName">The team or name shown, required, at most 80 characters.</param>
/// <param name="ProductLineId">The line the upload is filed under, required.</param>
/// <param name="Pieces">The pieces, a whole number from 1 to 9,999; null for none.</param>
/// <param name="Note">The note, at most 120 characters; empty for none.</param>
/// <param name="IsShown">True to show the upload on the website. A new upload is hidden when this is missing; an edit keeps it as it is when this is missing.</param>
/// <param name="Version">The version the form was opened with; required when editing, ignored when adding.</param>
public sealed record GalleryUploadRequest(string? TeamName, Guid? ProductLineId, decimal? Pieces, string? Note, bool? IsShown, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing part.</summary>
    public static GalleryUploadRequest Empty { get; } = new(null, null, null, null, null, null);

    /// <summary>Gets what the form holds, for the domain.</summary>
    /// <returns>The values.</returns>
    public GalleryUploadValues ToValues() => new(TeamName, ProductLineId, Pieces, Note, IsShown);
}

/// <summary>A new upload: the form and the photo file as it was sent.</summary>
/// <param name="Form">The form fields.</param>
/// <param name="Bytes">The file bytes; empty when no file was sent.</param>
/// <param name="FileName">The client's file name, used only in messages.</param>
public sealed record CreateGalleryUploadRequest(GalleryUploadRequest Form, ReadOnlyMemory<byte> Bytes, string? FileName);
