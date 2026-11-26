using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteRequestStatusChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PhotosRemovedAtUtc",
                table: "QuoteRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuoteRequestStatusChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuoteRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromStatus = table.Column<byte>(type: "tinyint", nullable: false),
                    ToStatus = table.Column<byte>(type: "tinyint", nullable: false),
                    ChangedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ChangedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuoteRequestStatusChanges", x => x.Id);
                    table.CheckConstraint("CK_QuoteRequestStatusChanges_FromStatus", "[FromStatus] BETWEEN 1 AND 6");
                    table.CheckConstraint("CK_QuoteRequestStatusChanges_ToStatus", "[ToStatus] BETWEEN 1 AND 6");
                    table.ForeignKey(
                        name: "FK_QuoteRequestStatusChanges_AspNetUsers_ChangedById",
                        column: x => x.ChangedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuoteRequestStatusChanges_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_QuoteRequestStatusChanges_QuoteRequests_QuoteRequestId",
                        column: x => x.QuoteRequestId,
                        principalTable: "QuoteRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestStatusChanges_ChangedById",
                table: "QuoteRequestStatusChanges",
                column: "ChangedById");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestStatusChanges_OrderId",
                table: "QuoteRequestStatusChanges",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestStatusChanges_QuoteRequestId_ChangedAtUtc",
                table: "QuoteRequestStatusChanges",
                columns: new[] { "QuoteRequestId", "ChangedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuoteRequestStatusChanges");

            migrationBuilder.DropColumn(
                name: "PhotosRemovedAtUtc",
                table: "QuoteRequests");
        }
    }
}
