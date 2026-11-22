using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "QuoteRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TeamName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactNumberE164 = table.Column<string>(type: "varchar(13)", unicode: false, maxLength: 13, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: true),
                    ProductChoice = table.Column<byte>(type: "tinyint", nullable: true),
                    ProductLineId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ProductTitle = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    QuantityRange = table.Column<byte>(type: "tinyint", nullable: true),
                    Message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<byte>(type: "tinyint", nullable: false),
                    StatusChangedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    EditVersion = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuoteRequests", x => x.Id);
                    table.CheckConstraint("CK_QuoteRequests_ProductChoice", "[ProductChoice] IS NULL OR [ProductChoice] BETWEEN 1 AND 3");
                    table.CheckConstraint("CK_QuoteRequests_QuantityRange", "[QuantityRange] IS NULL OR [QuantityRange] BETWEEN 1 AND 5");
                    table.CheckConstraint("CK_QuoteRequests_Status", "[Status] BETWEEN 1 AND 6");
                    table.ForeignKey(
                        name: "FK_QuoteRequests_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuoteRequests_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuoteRequests_ProductLines_ProductLineId",
                        column: x => x.ProductLineId,
                        principalTable: "ProductLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_ContactNumberE164_CreatedAtUtc",
                table: "QuoteRequests",
                columns: new[] { "ContactNumberE164", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_CreatedAtUtc",
                table: "QuoteRequests",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_CreatedById",
                table: "QuoteRequests",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_Email_CreatedAtUtc",
                table: "QuoteRequests",
                columns: new[] { "Email", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_ProductLineId",
                table: "QuoteRequests",
                column: "ProductLineId");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_Status_CreatedAtUtc",
                table: "QuoteRequests",
                columns: new[] { "Status", "CreatedAtUtc", "Id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequests_UpdatedById",
                table: "QuoteRequests",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuoteRequests");
        }
    }
}
