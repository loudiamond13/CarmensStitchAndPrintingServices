using System.Net.Http.Headers;
using System.Text;

namespace Csps.Testing;

/// <summary>One part of a multipart form body: a text field, or a file with a name and content type.</summary>
/// <param name="Name">The form field name.</param>
/// <param name="Content">The part bytes.</param>
/// <param name="FileName">The file name for a file part; null for a text field.</param>
/// <param name="ContentType">The content type of the part; none when null.</param>
public sealed record MultipartPart(string Name, byte[] Content, string? FileName = null, string? ContentType = null)
{
    /// <summary>Makes a text field.</summary>
    /// <param name="name">The form field name.</param>
    /// <param name="value">The text, sent as UTF-8.</param>
    /// <returns>The part.</returns>
    public static MultipartPart Text(string name, string value) => new(name, Encoding.UTF8.GetBytes(value));

    /// <summary>Makes a file part.</summary>
    /// <param name="name">The form field name.</param>
    /// <param name="bytes">The file bytes.</param>
    /// <param name="fileName">The file name.</param>
    /// <param name="contentType">The content type.</param>
    /// <returns>The part.</returns>
    public static MultipartPart Upload(string name, byte[] bytes, string fileName = "photo.jpg", string contentType = "image/jpeg") => new(name, bytes, fileName, contentType);
}

/// <summary>
/// Builds a multipart form body by hand with a boundary the test chooses, so the same bytes can be sent twice (a retry) or the boundary
/// can be changed while the parts stay the same.
/// </summary>
public static class MultipartBodies
{
    private const string Crlf = "\r\n";

    /// <summary>Builds the body bytes.</summary>
    /// <param name="boundary">The boundary text, without the leading dashes.</param>
    /// <param name="parts">The parts, in order.</param>
    /// <returns>The body.</returns>
    public static byte[] Build(string boundary, IEnumerable<MultipartPart> parts)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(boundary);
        ArgumentNullException.ThrowIfNull(parts);

        using var body = new MemoryStream();
        foreach (var part in parts)
        {
            Write(body, $"--{boundary}{Crlf}");
            var disposition = $"Content-Disposition: form-data; name=\"{part.Name}\"";
            if (part.FileName is not null)
            {
                disposition += $"; filename=\"{part.FileName}\"";
            }

            Write(body, disposition + Crlf);
            if (part.ContentType is not null)
            {
                Write(body, $"Content-Type: {part.ContentType}{Crlf}");
            }

            Write(body, Crlf);
            body.Write(part.Content);
            Write(body, Crlf);
        }

        Write(body, $"--{boundary}--{Crlf}");
        return body.ToArray();
    }

    /// <summary>Builds the body and wraps it in request content with the matching <c>multipart/form-data</c> content type.</summary>
    /// <param name="boundary">The boundary text, without the leading dashes.</param>
    /// <param name="parts">The parts, in order.</param>
    /// <returns>The content. The caller disposes it.</returns>
    public static ByteArrayContent Content(string boundary, IEnumerable<MultipartPart> parts)
    {
        var content = new ByteArrayContent(Build(boundary, parts));
        content.Headers.ContentType = new MediaTypeHeaderValue("multipart/form-data") { Parameters = { new NameValueHeaderValue("boundary", boundary) } };
        return content;
    }

    private static void Write(MemoryStream body, string text) => body.Write(Encoding.UTF8.GetBytes(text));
}
