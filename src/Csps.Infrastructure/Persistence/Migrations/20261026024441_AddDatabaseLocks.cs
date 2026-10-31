using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDatabaseLocks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DatabaseLocks",
                columns: table => new
                {
                    Name = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: false),
                    TakenAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    HolderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatabaseLocks", x => x.Name);
                });

            migrationBuilder.InsertData(
                table: "DatabaseLocks",
                columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
                values: new object[,]
                {
                    { "account-token:00", null, null, null },
                    { "account-token:01", null, null, null },
                    { "account-token:02", null, null, null },
                    { "account-token:03", null, null, null },
                    { "account-token:04", null, null, null },
                    { "account-token:05", null, null, null },
                    { "account-token:06", null, null, null },
                    { "account-token:07", null, null, null },
                    { "account-token:08", null, null, null },
                    { "account-token:09", null, null, null },
                    { "account-token:10", null, null, null },
                    { "account-token:11", null, null, null },
                    { "account-token:12", null, null, null },
                    { "account-token:13", null, null, null },
                    { "account-token:14", null, null, null },
                    { "account-token:15", null, null, null },
                    { "account-token:16", null, null, null },
                    { "account-token:17", null, null, null },
                    { "account-token:18", null, null, null },
                    { "account-token:19", null, null, null },
                    { "account-token:20", null, null, null },
                    { "account-token:21", null, null, null },
                    { "account-token:22", null, null, null },
                    { "account-token:23", null, null, null },
                    { "account-token:24", null, null, null },
                    { "account-token:25", null, null, null },
                    { "account-token:26", null, null, null },
                    { "account-token:27", null, null, null },
                    { "account-token:28", null, null, null },
                    { "account-token:29", null, null, null },
                    { "account-token:30", null, null, null },
                    { "account-token:31", null, null, null },
                    { "account-token:32", null, null, null },
                    { "account-token:33", null, null, null },
                    { "account-token:34", null, null, null },
                    { "account-token:35", null, null, null },
                    { "account-token:36", null, null, null },
                    { "account-token:37", null, null, null },
                    { "account-token:38", null, null, null },
                    { "account-token:39", null, null, null },
                    { "account-token:40", null, null, null },
                    { "account-token:41", null, null, null },
                    { "account-token:42", null, null, null },
                    { "account-token:43", null, null, null },
                    { "account-token:44", null, null, null },
                    { "account-token:45", null, null, null },
                    { "account-token:46", null, null, null },
                    { "account-token:47", null, null, null },
                    { "account-token:48", null, null, null },
                    { "account-token:49", null, null, null },
                    { "account-token:50", null, null, null },
                    { "account-token:51", null, null, null },
                    { "account-token:52", null, null, null },
                    { "account-token:53", null, null, null },
                    { "account-token:54", null, null, null },
                    { "account-token:55", null, null, null },
                    { "account-token:56", null, null, null },
                    { "account-token:57", null, null, null },
                    { "account-token:58", null, null, null },
                    { "account-token:59", null, null, null },
                    { "account-token:60", null, null, null },
                    { "account-token:61", null, null, null },
                    { "account-token:62", null, null, null },
                    { "account-token:63", null, null, null },
                    { "active-managers", null, null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_DatabaseLocks_ExpiresAtUtc",
                table: "DatabaseLocks",
                column: "ExpiresAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DatabaseLocks");
        }
    }
}
