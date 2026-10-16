using System.Security.Cryptography;
using System.Text;
using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

public sealed class TokenHashTests
{
    [Fact]
    public void ComputeIsSha256OfTheUtf8Bytes()
    {
        var hash = TokenHash.Compute("abc");

        hash.Length.ShouldBe(TokenHash.HashLength);
        hash.ShouldBe(SHA256.HashData(Encoding.UTF8.GetBytes("abc")));
    }

    [Fact]
    public void EqualIsTrueForEqualArrays()
    {
        TokenHash.Equal(TokenHash.Compute("a"), TokenHash.Compute("a")).ShouldBeTrue();
    }

    [Fact]
    public void EqualIsFalseWhenOneByteDiffers()
    {
        var left = TokenHash.Compute("a");
        var right = (byte[])left.Clone();
        right[^1] ^= 0x01;

        TokenHash.Equal(left, right).ShouldBeFalse();
    }

    [Fact]
    public void EqualIsFalseForDifferentLengths()
    {
        TokenHash.Equal(new byte[32], new byte[31]).ShouldBeFalse();
    }
}
