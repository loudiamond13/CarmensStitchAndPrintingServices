namespace Csps.Domain.Analytics;

/// <summary>The three Core Web Vitals the site measures (D-26). The number is stored, so the values never change.</summary>
public enum VitalMetric : byte
{
    /// <summary>Largest Contentful Paint, in milliseconds.</summary>
    Lcp = 1,

    /// <summary>Cumulative Layout Shift, a unitless score.</summary>
    Cls = 2,

    /// <summary>Interaction to Next Paint, in milliseconds.</summary>
    Inp = 3,
}
