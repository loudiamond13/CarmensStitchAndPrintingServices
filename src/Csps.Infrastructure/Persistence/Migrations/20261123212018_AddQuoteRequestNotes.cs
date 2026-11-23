using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteRequestNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuoteRequestNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuoteRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuoteRequestNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuoteRequestNotes_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuoteRequestNotes_QuoteRequests_QuoteRequestId",
                        column: x => x.QuoteRequestId,
                        principalTable: "QuoteRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestNotes_CreatedById",
                table: "QuoteRequestNotes",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestNotes_QuoteRequestId_CreatedAtUtc",
                table: "QuoteRequestNotes",
                columns: new[] { "QuoteRequestId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuoteRequestNotes");
        }
    }
}
