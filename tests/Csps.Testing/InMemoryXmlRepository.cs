using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;

namespace Csps.Testing;

/// <summary>
/// A Data Protection key store that lives only in memory, for test hosts that have no database. Without it, the
/// framework's start-up key-ring preload would try the never-created test database and wait out SqlClient's retry.
/// Keys are still encrypted with the test certificate before they reach this store.
/// </summary>
internal sealed class InMemoryXmlRepository : IXmlRepository
{
    private readonly Lock _gate = new();
    private readonly List<XElement> _elements = [];

    public IReadOnlyCollection<XElement> GetAllElements()
    {
        lock (_gate)
        {
            return [.. _elements.Select(element => new XElement(element))];
        }
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        ArgumentNullException.ThrowIfNull(element);
        lock (_gate)
        {
            _elements.Add(new XElement(element));
        }
    }
}
