namespace Csps.Domain.Content;

/// <summary>One seeded product line: its fixed id and the approved text (D-06, UI spec 7.1 and 7.2).</summary>
/// <param name="Id">The fixed id.</param>
/// <param name="Key">The key the page anchors and gallery filters use.</param>
/// <param name="Title">The title.</param>
/// <param name="ShortName">The short name.</param>
/// <param name="Number">The number on the drawing.</param>
/// <param name="CardText">The Home card text.</param>
/// <param name="Description">The Products page description.</param>
/// <param name="FabricText">What the Fabric card says.</param>
/// <param name="CollarText">What the Collar style card says.</param>
/// <param name="CutText">What the Cut and fit card says.</param>
/// <param name="NamesText">What the Names and numbers card says.</param>
/// <param name="LogosText">What the Logos and sponsors card says.</param>
/// <param name="Position">The display order from 1.</param>
/// <param name="PlaceholderArt">The drawing shown until there are photos.</param>
public sealed record ProductLineSeedEntry(
    Guid Id,
    string Key,
    string Title,
    string ShortName,
    string Number,
    string CardText,
    string Description,
    string FabricText,
    string CollarText,
    string CutText,
    string NamesText,
    string LogosText,
    int Position,
    PlaceholderArt PlaceholderArt);

/// <summary>
/// The six product lines every database starts with (D-06): basketball, volleyball, moto, long sleeves, polo and custom, shown, with no
/// price and no minimum (D-40). The migration inserts them once with the same values written out as literals; a test compares the two.
/// The model never seeds them (no <c>HasData</c>), so a later deploy cannot overwrite a Manager's edits. The text is the UI spec text with
/// no long dashes.
/// </summary>
public static class ProductLineSeed
{
    /// <summary>The creation stamp of the seeded rows.</summary>
    public static readonly DateTimeOffset SeededAtUtc = new(2026, 11, 11, 0, 0, 0, TimeSpan.Zero);

    /// <summary>The six lines in display order.</summary>
    public static readonly IReadOnlyList<ProductLineSeedEntry> All =
    [
        new(
            Guid.Parse("3a48a1d6-c812-4481-a6be-d7d7412484a0"),
            "basketball",
            "Basketball Jerseys",
            "Basketball",
            "23",
            "Full sublimation tops and shorts, any colorway, names and numbers included.",
            "Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat.",
            "Dri-fit mesh, aircool or spandex blend",
            "V-neck, round or layered",
            "Standard, slim, women's fit and kids",
            "Any font: front, back and shorts",
            "Team crest, sponsors and barangay seal in full color",
            1,
            PlaceholderArt.Basketball),
        new(
            Guid.Parse("1416d96d-04dc-474e-98a5-2266ac382f74"),
            "volleyball",
            "Volleyball Jerseys",
            "Volleyball",
            "11",
            "Lightweight, stretch-fit cuts for indoor and beach teams.",
            "Light, stretchy and quick-drying for every dig and spike, indoor or beach.",
            "Aircool micro-eyelet or spandex",
            "Round, V-neck or mandarin",
            "Sleeveless, cap sleeve or short sleeve",
            "Libero colorway option included",
            "Club crest and sponsors, front and back",
            2,
            PlaceholderArt.Volleyball),
        new(
            Guid.Parse("6ff58459-2a70-4876-ad50-9fb1ff1ba6c0"),
            "moto",
            "Moto Riding Jerseys",
            "Moto",
            "07",
            "Breathable long-sleeve riding tops with club crests and sponsor logos.",
            "Long-sleeve riding tops that breathe on long hauls and keep your club's colors loud on the road.",
            "Breathable mesh or UV-protect knit",
            "Crew, zip-neck or mandarin",
            "Racing fit or relaxed, thumb loops optional",
            "Rider name, club rank, plate number on sleeve",
            "Club crest, chapter name and sponsor patches",
            3,
            PlaceholderArt.Moto),
        new(
            Guid.Parse("87f4ec3b-8120-457e-92df-204a4cdf7de1"),
            "longsleeves",
            "Long Sleeves",
            "Long Sleeves",
            "14",
            "Warm-ups, shooting shirts and dri-fit long sleeves for training days.",
            "Warm-ups, shooting shirts and everyday dri-fit long sleeves for training days and team events.",
            "Dri-fit, cotton-spandex or UV-protect",
            "Crew, hooded or quarter-zip",
            "Regular, athletic or raglan",
            "Names on back or sleeve",
            "Printed or embroidered logos",
            4,
            PlaceholderArt.LongSleeves),
        new(
            Guid.Parse("8557a14d-153f-4e6e-bb21-5d993f82426b"),
            "polo",
            "Polo Shirts",
            "Polo",
            "03",
            "Sublimated or plain polos for coaches, staff, events and offices.",
            "Clean polos for coaches, staff, reunions and company events, sublimated or plain.",
            "Honeycomb piqué, dri-fit piqué or cotton",
            "Classic, mandarin or tipped",
            "Men's, women's and unisex",
            "Embroidered or printed name on chest",
            "Embroidered or sublimated logos",
            5,
            PlaceholderArt.Polo),
        new(
            Guid.Parse("ca2ee9a1-6098-492a-b753-dabf5805a7bb"),
            "custom",
            "Custom Designs",
            "Custom",
            "00",
            "Bring a sketch or just an idea. Our artists build the full design.",
            "Have only an idea or a phone photo? Our artists build the full design from scratch and send you a mockup.",
            "Any of our fabrics",
            "Any collar we offer",
            "Our patterns, or match a sample you send",
            "Full roster from a spreadsheet",
            "We redraw and vectorize logos from a photo",
            6,
            PlaceholderArt.Custom),
    ];
}
