namespace Csps.Application.Analytics;

/// <summary>What the server knows about the call besides its body (D-20, ANL-05).</summary>
/// <param name="Gpc">True when the request carried <c>Sec-GPC: 1</c>.</param>
/// <param name="HasVisitorId">True when the request already carried a well-formed visitor id cookie.</param>
public sealed record ConsentCallContext(bool Gpc, bool HasVisitorId);
