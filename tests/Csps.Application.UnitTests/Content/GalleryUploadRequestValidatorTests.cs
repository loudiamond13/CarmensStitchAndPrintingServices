using Csps.Application.Content;
using FluentValidation;

namespace Csps.Application.UnitTests.Content;

/// <summary>OR-3, GAL-03: the gallery upload form is checked with the UI-SPEC messages, the same rules as the domain, with the photo and the version marked by the caller.</summary>
public sealed class GalleryUploadRequestValidatorTests
{
    private static readonly Guid Moto = Guid.Parse("b3d5f7a9-1c2e-4a60-8b94-5d7e9f1a3c20");
    private static readonly GalleryUploadRequestValidator Validator = new();

    private static GalleryUploadRequest Valid { get; } = new("Tondo Sample Riders", Moto, 12m, "Dri-fit mesh", true, null);

    private static Dictionary<string, string[]> Errors(GalleryUploadRequest request, bool edit = false, bool photoMissing = false)
    {
        var context = new ValidationContext<GalleryUploadRequest>(request);
        if (edit)
        {
            context.RootContextData[GalleryUploadRequestValidator.EditKey] = true;
        }

        if (photoMissing)
        {
            context.RootContextData[GalleryUploadRequestValidator.PhotoMissingKey] = true;
        }

        return Validator.Validate(context).Errors
            .GroupBy(failure => failure.PropertyName, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Select(failure => failure.ErrorMessage).ToArray(), StringComparer.Ordinal);
    }

    [Fact]
    public void AValidFormHasNoErrors()
    {
        Errors(Valid).ShouldBeEmpty();
        Errors(Valid with { Version = "AQIDBAUGBwg=" }, edit: true).ShouldBeEmpty();
    }

    [Fact]
    public void AnAddWithNoPhotoIsToldToChooseOneUnderFile()
    {
        var errors = Errors(Valid, photoMissing: true);

        errors.Keys.ShouldBe(["file"]);
        errors["file"].ShouldBe(["Choose a photo."]);
    }

    [Fact]
    public void ATeamIsRequiredAndAtMostEightyCharacters()
    {
        Errors(Valid with { TeamName = null })["teamName"].ShouldBe(["Enter the team or name."]);
        Errors(Valid with { TeamName = "  " })["teamName"].ShouldBe(["Enter the team or name."]);
        Errors(Valid with { TeamName = new string('a', 80) }).ShouldBeEmpty();
        Errors(Valid with { TeamName = new string('a', 81) })["teamName"].ShouldBe(["Keep this to 80 characters or fewer."]);
    }

    [Fact]
    public void ALineIsRequired()
    {
        Errors(Valid with { ProductLineId = null })["productLineId"].ShouldBe(["Choose the product line."]);
    }

    [Fact]
    public void AnEditNeedsAVersion()
    {
        Errors(Valid, edit: true)["Version"].ShouldBe([Csps.Application.Common.RowVersions.InvalidMessage]);
        Errors(Valid with { Version = "not a version" }, edit: true).ShouldContainKey("Version");
    }

    [Fact]
    public void TheEmptyRequestReportsEveryMissingPart()
    {
        Errors(GalleryUploadRequest.Empty, edit: true, photoMissing: true).Keys.ShouldBe(["file", "Version", "teamName", "productLineId"], ignoreOrder: true);
    }
}
