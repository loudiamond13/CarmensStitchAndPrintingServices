using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMoneyTransfers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MoneyTransfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IsHandover = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DeletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MoneyTransfers", x => x.Id);
                    table.CheckConstraint("CK_MoneyTransfers_Amount_Positive", "[Amount] > 0");
                    table.CheckConstraint("CK_MoneyTransfers_FromTo_Different", "[FromUserId] <> [ToUserId]");
                    table.ForeignKey(
                        name: "FK_MoneyTransfers_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MoneyTransfers_AspNetUsers_DeletedById",
                        column: x => x.DeletedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MoneyTransfers_AspNetUsers_FromUserId",
                        column: x => x.FromUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MoneyTransfers_AspNetUsers_ToUserId",
                        column: x => x.ToUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MoneyTransfers_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                table: "DatabaseLocks",
                columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
                values: new object[] { "staff-money", null, null, null });

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_CreatedById",
                table: "MoneyTransfers",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_DeletedById",
                table: "MoneyTransfers",
                column: "DeletedById");

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_FromUserId",
                table: "MoneyTransfers",
                column: "FromUserId")
                .Annotation("SqlServer:Include", new[] { "Amount", "TransferDate", "CreatedAtUtc", "DeletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_List",
                table: "MoneyTransfers",
                columns: new[] { "TransferDate", "CreatedAtUtc", "Id" },
                descending: new[] { true, true, false });

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_ToUserId",
                table: "MoneyTransfers",
                column: "ToUserId")
                .Annotation("SqlServer:Include", new[] { "Amount", "TransferDate", "CreatedAtUtc", "DeletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MoneyTransfers_UpdatedById",
                table: "MoneyTransfers",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MoneyTransfers");

            migrationBuilder.DeleteData(
                table: "DatabaseLocks",
                keyColumn: "Name",
                keyValue: "staff-money");
        }
    }
}
