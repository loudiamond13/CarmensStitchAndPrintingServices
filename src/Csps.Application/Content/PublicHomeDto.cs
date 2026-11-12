using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>One product line card on the Home page (PUB-02, D-01): what a visitor needs to draw it and link to its place on Products.</summary>
/// <param name="Key">The key the card links to, such as "basketball" (<c>/products#basketball</c>).</param>
/// <param name="Number">The number drawn on the jersey, such as "23".</param>
/// <param name="Title">The title, such as "Basketball Jerseys".</param>
/// <param name="CardText">The card text.</param>
/// <param name="PlaceholderArt">The drawing shown when the line has no photo: <c>basketball</c>, <c>volleyball</c>, <c>moto</c>, <c>longSleeves</c>, <c>polo</c> or <c>custom</c>.</param>
/// <param name="CardPhoto">The line's main photo at the 4:5 card sizes; null until a Manager adds one.</param>
public sealed record PublicHomeLineDto(string Key, string Number, string Title, string CardText, string PlaceholderArt, PublicPhotoDto? CardPhoto);

/// <summary>One testimonial a visitor sees (CONT-03, D-05).</summary>
/// <param name="Quote">The customer's words.</param>
/// <param name="Name">The name shown under the quote.</param>
/// <param name="TeamOrRole">The team or role line; null when not set.</param>
/// <param name="Stars">The rating, 1 to 5.</param>
public sealed record PublicTestimonialDto(string Quote, string Name, string? TeamOrRole, int Stars);

/// <summary>One tile of the Home page's Recent work strip. It stays empty until the plan that reads shown orders fills it.</summary>
/// <param name="Team">The public name of the order.</param>
/// <param name="LineKey">The key of the order's line, which the tile links to in the Gallery.</param>
/// <param name="LineShortName">The short name of the order's line.</param>
/// <param name="Pieces">The number of pieces; null when unknown.</param>
/// <param name="PlaceholderArt">The drawing shown when the order has no photo.</param>
/// <param name="Photo">The cover photo; null when there is none.</param>
public sealed record PublicRecentWorkDto(string Team, string LineKey, string LineShortName, int? Pieces, string PlaceholderArt, PublicPhotoDto? Photo);

/// <summary>The Home page's hero tag: the newest shown order. It stays null until the plan that reads shown orders fills it.</summary>
/// <param name="Name">The public name of the order.</param>
/// <param name="Pieces">The number of pieces.</param>
public sealed record PublicHeroTagDto(string Name, int Pieces);

/// <summary>
/// What the Home page needs in one read (PUB-02, CONT-03): the shown product lines as cards, the count of shown lines, the first three
/// shown testimonials in display order, the Recent work strip and the hero tag. The last two are empty until a later plan fills them.
/// </summary>
/// <param name="Lines">The shown product lines in display order.</param>
/// <param name="LineCount">How many lines are shown.</param>
/// <param name="Testimonials">The first three shown testimonials in display order; empty when none is shown.</param>
/// <param name="RecentWork">The Recent work tiles; empty for now.</param>
/// <param name="HeroTag">The hero tag; null for now.</param>
public sealed record PublicHomeDto(
    IReadOnlyList<PublicHomeLineDto> Lines,
    int LineCount,
    IReadOnlyList<PublicTestimonialDto> Testimonials,
    IReadOnlyList<PublicRecentWorkDto> RecentWork,
    PublicHeroTagDto? HeroTag);

/// <summary>The Home data as one cached value: the typed data and the JSON the API and the boot data block send.</summary>
/// <param name="Home">The typed data.</param>
/// <param name="Json">The same data as JSON with its ETag.</param>
[ImmutableObject(true)]
public sealed record PublicHomeSnapshot(PublicHomeDto Home, PublicJsonSnapshot Json);
