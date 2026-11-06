using System.Security.Cryptography;
using System.Text;

namespace Csps.Application.Images;

/// <summary>
/// Makes the ids order photos are stored under (IMG-03, D-01). With public delivery the address is the only key to a customer's photo,
/// so an id is 128 random bits from the system generator, never built from the file name, a counter or a Guid.
/// </summary>
public static class PublicIds
{
    private const int RandomBytes = 16;
    private const string Alphabet = "abcdefghijklmnopqrstuvwxyz234567";

    /// <summary>Gets the storage folder of an order's photos.</summary>
    /// <param name="root">The environment's root folder, such as <c>csps</c>.</param>
    /// <param name="orderId">The order id.</param>
    /// <returns>The folder, without a trailing slash.</returns>
    public static string Folder(string root, Guid orderId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(root);
        return $"{root}/orders/{orderId:D}";
    }

    /// <summary>Makes a new random public id inside the order's folder.</summary>
    /// <param name="root">The environment's root folder.</param>
    /// <param name="orderId">The order id.</param>
    /// <returns>The folder, a slash and 26 lowercase base32 characters.</returns>
    public static string New(string root, Guid orderId) => $"{Folder(root, orderId)}/{Base32(RandomNumberGenerator.GetBytes(RandomBytes))}";

    // RFC 4648 base32 in lowercase without padding: 16 bytes make 26 characters.
    private static string Base32(ReadOnlySpan<byte> bytes)
    {
        var text = new StringBuilder((bytes.Length * 8 / 5) + 1);
        var buffer = 0;
        var bits = 0;
        foreach (var value in bytes)
        {
            buffer = (buffer << 8) | value;
            bits += 8;
            while (bits >= 5)
            {
                text.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }

            buffer &= (1 << bits) - 1;
        }

        if (bits > 0)
        {
            text.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        }

        return text.ToString();
    }
}
