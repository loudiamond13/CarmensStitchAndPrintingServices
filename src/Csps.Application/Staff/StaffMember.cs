namespace Csps.Application.Staff;

/// <summary>One person who can be named as the payer (CEXP-05): an id and a name, nothing else.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Name">The first and last name as saved, joined by one space.</param>
public sealed record StaffMember(Guid Id, string Name);
