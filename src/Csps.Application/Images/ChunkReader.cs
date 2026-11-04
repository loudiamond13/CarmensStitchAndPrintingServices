using System.Buffers.Binary;

namespace Csps.Application.Images;

/// <summary>How the chunks or boxes of a format are laid out.</summary>
internal enum ChunkLayout
{
    /// <summary>A 32-bit big-endian length, the 4-letter type, the data, then a 4-byte checksum.</summary>
    Png,

    /// <summary>The 4-letter type, a 32-bit little-endian length, the data, then one pad byte when the length is odd.</summary>
    WebP,

    /// <summary>
    /// A 32-bit big-endian size that covers the 8-byte header, the 4-letter type, then the payload. A size of 1 means a 64-bit size
    /// follows; a size of 0 or less than the header is refused.
    /// </summary>
    Box,
}

/// <summary>
/// The one bounded reader behind all the container formats, shared by the sniffer and the metadata stripper. Every length is checked
/// against what is left of the span, a length that is wrong in any way ends the walk, and the walk stops after a fixed number of
/// entries, so a hostile file cannot cause a read past the end, a loop that does not advance, or a long scan.
/// </summary>
internal ref struct ChunkReader
{
    private const int MaxChunks = 512;

    private readonly ReadOnlySpan<byte> _data;
    private readonly ChunkLayout _layout;
    private int _position;
    private int _count;

    public ChunkReader(ReadOnlySpan<byte> data, ChunkLayout layout)
    {
        _data = data;
        _layout = layout;
        _position = 0;
        _count = 0;
    }

    /// <summary>Gets a value indicating whether every byte was read as part of an entry (false after a bad entry or the entry cap).</summary>
    public readonly bool AtEnd => _position >= _data.Length;

    public bool Next(out ReadOnlySpan<byte> type, out ReadOnlySpan<byte> payload) => Next(out type, out payload, out _, out _);

    /// <summary>Reads the next entry.</summary>
    /// <param name="type">The 4-letter type.</param>
    /// <param name="payload">The data of the entry.</param>
    /// <param name="start">Where the entry begins, counted from the start of the span given to the reader.</param>
    /// <param name="length">How many bytes the entry covers, header and trailer included (cut short when the file ends first).</param>
    /// <returns>False when there is no further whole entry.</returns>
    public bool Next(out ReadOnlySpan<byte> type, out ReadOnlySpan<byte> payload, out int start, out int length)
    {
        type = default;
        payload = default;
        start = _position;
        length = 0;
        if (_count >= MaxChunks || !TryMeasure(out var typeAt, out var payloadAt, out var payloadSize, out var total))
        {
            return false;
        }

        type = _data.Slice(_position + typeAt, 4);
        payload = _data.Slice(_position + payloadAt, payloadSize);
        length = Math.Min(total, _data.Length - _position);
        _position += total;
        _count++;
        return true;
    }

    // Works out where the type and payload sit and how far the entry reaches, or fails when it does not fit in the span.
    private readonly bool TryMeasure(out int typeAt, out int payloadAt, out int payloadSize, out int total)
    {
        typeAt = 4;
        payloadAt = 8;
        payloadSize = 0;
        total = 0;
        var left = _data.Length - _position;
        switch (_layout)
        {
            case ChunkLayout.Png:
                if (left < 12 || BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]) > left - 12)
                {
                    return false;
                }

                payloadSize = (int)BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]);
                total = payloadSize + 12;
                return true;
            case ChunkLayout.WebP:
                if (left < 8 || BinaryPrimitives.ReadUInt32LittleEndian(_data[(_position + 4)..]) > left - 8)
                {
                    return false;
                }

                typeAt = 0;
                payloadSize = (int)BinaryPrimitives.ReadUInt32LittleEndian(_data[(_position + 4)..]);
                total = 8 + payloadSize + (payloadSize & 1);
                return true;
            default:
                return TryMeasureBox(left, out payloadAt, out payloadSize, out total);
        }
    }

    private readonly bool TryMeasureBox(int left, out int payloadAt, out int payloadSize, out int total)
    {
        payloadAt = 8;
        payloadSize = 0;
        total = 0;
        if (left < 8)
        {
            return false;
        }

        long size = BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]);
        if (size == 1)
        {
            if (left < 16 || BinaryPrimitives.ReadUInt64BigEndian(_data[(_position + 8)..]) > int.MaxValue)
            {
                return false;
            }

            size = (long)BinaryPrimitives.ReadUInt64BigEndian(_data[(_position + 8)..]);
            payloadAt = 16;
        }

        if (size < payloadAt || size > left)
        {
            return false;
        }

        payloadSize = (int)size - payloadAt;
        total = (int)size;
        return true;
    }
}
