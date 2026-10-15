using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Domain.Identity;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Identity;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The CSPS EF Core context, which also holds the Identity tables (staff accounts and roles). Configuration is Fluent only, one <c>IEntityTypeConfiguration</c> per entity
/// in <c>Persistence/Configurations</c>. The schema comes from migrations alone; nothing migrates or seeds
/// at application startup (D-08).
/// </summary>
/// <param name="options">Options built through <see cref="CspsDbContextOptions.Configure"/>.</param>
public sealed class CspsDbContext(DbContextOptions<CspsDbContext> options) : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    /// <summary>The SiteSettings singleton (one row, Id 1).</summary>
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    /// <summary>The append-only audit log. Add entries only; the database rejects changes and removals.</summary>
    public DbSet<AuditEntry> AuditLog => Set<AuditEntry>();

    /// <summary>The email outbox: queued auth mail, encrypted until sent (AUTH-13).</summary>
    public DbSet<EmailOutboxMessage> EmailOutbox => Set<EmailOutboxMessage>();

    /// <summary>Pending sign-ins; each holds only the hash of its ticket (AUTH-03).</summary>
    public DbSet<TwoFactorChallenge> TwoFactorChallenges => Set<TwoFactorChallenge>();

    /// <summary>The emailed codes of the sign-ins; each holds only the HMAC of its code (AUTH-03).</summary>
    public DbSet<TwoFactorCode> TwoFactorCodes => Set<TwoFactorCode>();

    /// <summary>Signed-in sessions; each carries its device label and revocation state (AUTH-05, D-43).</summary>
    public DbSet<UserSession> UserSessions => Set<UserSession>();

    /// <summary>The single-use refresh tokens of the sessions; each holds only the SHA-256 of its token (AUTH-05).</summary>
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /// <summary>Single-use link tokens (password reset, invitation); each holds only the SHA-256 of its token (AUTH-08, D-28).</summary>
    public DbSet<AccountToken> AccountTokens => Set<AccountToken>();

    /// <summary>The stored answers of idempotent POSTs, kept 24 hours (SEC-06, D-40).</summary>
    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    /// <summary>The Data Protection key ring, written only by the framework; each key is certificate-encrypted XML (SEC-04).</summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(CspsDbContext).Assembly);
    }
}
