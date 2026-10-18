using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "AspNetUsers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EditVersion",
                table: "AspNetUsers",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ManagerLockedAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingEmail",
                table: "AspNetUsers",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UpdatedById",
                table: "AspNetUsers",
                type: "uniqueidentifier",
                nullable: true);

            // Accounts that existed before Phase 5: the earliest bootstrap or invite audit entry dates them, else now.
            // Re-running is safe: only rows still without a date are touched, and AuditLog is only read.
            // EXEC defers compiling the column name, which the idempotent script would otherwise reject in the batch that adds it.
            const string Backfill =
                """
                UPDATE u
                SET CreatedAtUtc = COALESCE(
                    (SELECT MIN(a.OccurredAtUtc)
                     FROM dbo.AuditLog a
                     WHERE a.TargetType = N'User'
                       AND a.Action IN (N'user.bootstrap-manager-created', N'user.invited')
                       AND a.TargetId = LOWER(CONVERT(nvarchar(36), u.Id))),
                    TODATETIMEOFFSET(SYSUTCDATETIME(), '+00:00'))
                FROM dbo.AspNetUsers u
                WHERE u.CreatedAtUtc IS NULL;
                """;
            migrationBuilder.Sql($"EXEC(N'{Backfill.Replace("'", "''", StringComparison.Ordinal)}');");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "CreatedAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "datetimeoffset",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_CreatedById",
                table: "AspNetUsers",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_UpdatedById",
                table: "AspNetUsers",
                column: "UpdatedById");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_CreatedById",
                table: "AspNetUsers",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_UpdatedById",
                table: "AspNetUsers",
                column: "UpdatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_CreatedById",
                table: "AspNetUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_AspNetUsers_UpdatedById",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_CreatedById",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_UpdatedById",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "DeletedAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EditVersion",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ManagerLockedAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "PendingEmail",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "UpdatedById",
                table: "AspNetUsers");
        }
    }
}
