using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slot = table.Column<byte>(type: "tinyint", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    PublicId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Width = table.Column<int>(type: "int", nullable: false),
                    Height = table.Column<int>(type: "int", nullable: false),
                    Bytes = table.Column<int>(type: "int", nullable: false),
                    Format = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderImages", x => x.Id);
                    table.CheckConstraint("CK_OrderImages_Position_Range", "[Position] BETWEEN 0 AND 4");
                    table.CheckConstraint("CK_OrderImages_Slot_Range", "[Slot] BETWEEN 0 AND 4");
                    table.ForeignKey(
                        name: "FK_OrderImages_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderImages_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderImages_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderImages_CreatedById",
                table: "OrderImages",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_OrderImages_OrderId_Position",
                table: "OrderImages",
                columns: new[] { "OrderId", "Position" })
                .Annotation("SqlServer:Include", new[] { "PublicId", "Width", "Height" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderImages_OrderId_Slot",
                table: "OrderImages",
                columns: new[] { "OrderId", "Slot" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderImages_PublicId",
                table: "OrderImages",
                column: "PublicId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderImages_UpdatedById",
                table: "OrderImages",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderImages");
        }
    }
}
