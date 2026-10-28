using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLegacyHolder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // IsActive is listed on purpose: the column default is true, and EF leaves a false value out of generated seed rows.
            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "ConcurrencyStamp", "CreatedAtUtc", "CreatedById", "DeletedAtUtc", "EditVersion", "Email", "EmailConfirmed", "FirstName", "IsActive", "LastName", "LockoutEnabled", "LockoutEnd", "ManagerLockedAtUtc", "MustChangePasswordReason", "NormalizedEmail", "NormalizedUserName", "PasswordHash", "PendingEmail", "PhoneNumber", "PhoneNumberConfirmed", "SecurityStamp", "TwoFactorEnabled", "UpdatedAtUtc", "UpdatedById", "UserName" },
                values: new object[] { new Guid("18ed889a-b94d-42f5-a5b0-ee2f47b437cd"), 0, "1C1442FA-A6FF-48DD-A9DC-A9D8E061C456", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, null, new Guid("4094c10f-b3f9-4b9b-8368-ab918b46a3b2"), null, false, "Legacy", false, "/ unassigned", false, null, null, null, null, null, null, null, null, false, "D794185C-717C-4A46-AFFF-FFC9616BFFE8", false, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: new Guid("18ed889a-b94d-42f5-a5b0-ee2f47b437cd"));
        }
    }
}
