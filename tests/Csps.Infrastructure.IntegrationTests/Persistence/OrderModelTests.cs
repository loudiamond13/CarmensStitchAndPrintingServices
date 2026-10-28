using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// Research Pitfall 5: an order and its children are all hidden by the same SoftDelete filter, so building the EF model logs no
/// warning (in particular none about a required navigation to a filtered entity). The host logs Microsoft.EntityFrameworkCore at
/// Warning, and the build must stay free of warnings.
/// </summary>
public sealed class OrderModelTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public void BuildingTheModelLogsNoEntityFrameworkWarning()
    {
        var captured = new CapturingProvider();

        BuildModel<CspsDbContext>(captured);

        captured.Warnings.ShouldBeEmpty($"EF logged: {string.Join(" | ", captured.Warnings)}");
        captured.Categories.ShouldContain(category => category.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal), "the capture saw EF log nothing at all, so it may not be wired");
    }

    [Fact]
    public void TheCaptureSeesTheWarningForAParentFilteredWithoutItsRequiredChildren()
    {
        var captured = new CapturingProvider();

        BuildModel<MismatchedContext>(captured);

        captured.Warnings.ShouldContain(warning => warning.Contains("query filter", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void EveryOrderEntityCarriesTheSoftDeleteFilterByName()
    {
        using var context = database.CreateContext();

        foreach (var type in new[] { typeof(Csps.Domain.Orders.Order), typeof(Csps.Domain.Orders.OrderItem), typeof(Csps.Domain.Orders.OrderDiscount), typeof(Csps.Domain.Orders.OrderPayment), typeof(Csps.Domain.Orders.OrderRefund), typeof(Csps.Domain.Orders.OrderExpense), typeof(Csps.Domain.Orders.OrderStatusChange) })
        {
            var entity = context.Model.FindEntityType(type).ShouldNotBeNull();
            entity.GetDeclaredQueryFilters().Select(filter => filter.Key).ShouldBe(["SoftDelete"], type.Name);
        }
    }

    private void BuildModel<TContext>(CapturingProvider provider)
        where TContext : DbContext
    {
        using var factory = LoggerFactory.Create(builder => builder.AddProvider(provider).SetMinimumLevel(LogLevel.Trace));
        var options = new DbContextOptionsBuilder<TContext>();
        if (typeof(TContext) == typeof(CspsDbContext))
        {
            CspsDbContextOptions.Configure(options, database.ConnectionString);
        }
        else
        {
            options.UseSqlServer(database.ConnectionString);
        }

        options.UseLoggerFactory(factory).EnableServiceProviderCaching(false);
        using var context = (TContext)Activator.CreateInstance(typeof(TContext), options.Options)!;

        // The model is built, validated and logged on first use.
        _ = context.Model;
    }

    private sealed class CapturingProvider : ILoggerProvider
    {
        private readonly List<string> _warnings = [];
        private readonly HashSet<string> _categories = [];

        public IReadOnlyList<string> Warnings => _warnings;

        public IReadOnlyCollection<string> Categories => _categories;

        public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, this);

        public void Dispose()
        {
        }

        private void Add(string category, LogLevel level, string message)
        {
            lock (_warnings)
            {
                _categories.Add(category);
                if (level >= LogLevel.Warning && category.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal))
                {
                    _warnings.Add($"{level} {category}: {message}");
                }
            }
        }

        private sealed class CapturingLogger(string category, CapturingProvider owner) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                owner.Add(category, logLevel, formatter(state, exception));
        }
    }

    // A parent with a filter and a required child with none: the shape the order tables must not have.
    private sealed class MismatchedContext(DbContextOptions<MismatchedContext> options) : DbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            builder.Entity<Parent>().HasQueryFilter(parent => parent.DeletedAtUtc == null);
            builder.Entity<Child>().HasOne(child => child.Parent).WithMany(parent => parent.Children).HasForeignKey(child => child.ParentId).IsRequired();
        }
    }

    private sealed class Parent
    {
        public int Id { get; set; }

        public DateTimeOffset? DeletedAtUtc { get; set; }

        public List<Child> Children { get; set; } = [];
    }

    private sealed class Child
    {
        public int Id { get; set; }

        public int ParentId { get; set; }

        public Parent Parent { get; set; } = null!;
    }
}
