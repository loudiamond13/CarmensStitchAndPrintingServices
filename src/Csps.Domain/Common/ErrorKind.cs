namespace Csps.Domain.Common;

/// <summary>The kinds of expected failure a use case can return (PRD section 3.3). Each maps to one HTTP status.</summary>
public enum ErrorKind
{
    /// <summary>The input breaks one or more field rules (400, with field errors).</summary>
    Validation,

    /// <summary>The thing asked for does not exist (404).</summary>
    NotFound,

    /// <summary>Someone else changed the thing first (409).</summary>
    Conflict,

    /// <summary>The input is well-formed but a business rule forbids the action (422).</summary>
    BusinessRule,

    /// <summary>The caller may not do this (403).</summary>
    Forbidden,

    /// <summary>The caller is not signed in, or the credentials are wrong (401).</summary>
    Unauthenticated,

    /// <summary>The caller must slow down (429).</summary>
    TooManyRequests,
}
