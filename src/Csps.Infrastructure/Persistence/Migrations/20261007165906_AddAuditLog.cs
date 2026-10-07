using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLog",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    TargetType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    TargetId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IpPrefix = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgentFamily = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    CorrelationId = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLog", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLog_OccurredAtUtc",
                table: "AuditLog",
                column: "OccurredAtUtc");

            // Hand-written below (FND-10, D-25, D-32). These Sql() calls MUST stay after CreateTable so the idempotent
            // script creates the table first (research Pitfall 3).

            // TRUNCATE fires no trigger, but SQL Server refuses to truncate a table that a foreign key references.
            // This guard table stays empty forever, so ordinary purge DELETEs are unaffected.
            migrationBuilder.Sql(
                """
                CREATE TABLE dbo.AuditLogTruncateGuard (
                    AuditLogId bigint NULL
                        CONSTRAINT FK_AuditLogTruncateGuard_AuditLog REFERENCES dbo.AuditLog (Id)
                );
                """);

            // Append-only trigger, owner decision D-32 (option-a, 2026-10-07): every UPDATE fails with 51000 and every
            // DELETE with 51001, except a DELETE on a connection that set the read-only session flag
            // csps.audit_purge = 1 where every deleted row is older than 8 months. Recent rows can never be deleted.
            // CREATE TRIGGER must be the first statement in its batch, so it runs inside EXEC (research Pitfall 3).
            migrationBuilder.Sql(
                """
                EXEC(N'CREATE TRIGGER dbo.TR_AuditLog_AppendOnly ON dbo.AuditLog AFTER UPDATE, DELETE AS
                BEGIN
                    SET NOCOUNT ON;
                    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
                    IF EXISTS (SELECT 1 FROM inserted)
                        THROW 51000, N''AuditLog is append-only: UPDATE is not allowed.'', 1;
                    IF CAST(SESSION_CONTEXT(N''csps.audit_purge'') AS int) = 1
                       AND NOT EXISTS (SELECT 1 FROM deleted WHERE OccurredAtUtc >= DATEADD(month, -8, SYSUTCDATETIME()))
                        RETURN;
                    THROW 51001, N''AuditLog is append-only: DELETE is not allowed.'', 1;
                END');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS dbo.TR_AuditLog_AppendOnly;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS dbo.AuditLogTruncateGuard;");

            migrationBuilder.DropTable(
                name: "AuditLog");
        }
    }
}
