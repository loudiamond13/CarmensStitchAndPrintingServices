#if CSPS_TESTING
namespace Csps.Server.Testing;

/// <summary>Marks a controller that exists only in the Testing environment of a Debug build (QUAL-05).</summary>
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = false)]
public sealed class TestingOnlyAttribute : Attribute;
#endif
