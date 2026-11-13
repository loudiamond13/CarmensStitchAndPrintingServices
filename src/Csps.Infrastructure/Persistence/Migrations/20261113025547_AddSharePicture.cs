using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSharePicture : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SharePictureBytes",
                table: "SiteSettings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SharePictureFormat",
                table: "SiteSettings",
                type: "varchar(8)",
                unicode: false,
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SharePictureHeight",
                table: "SiteSettings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SharePicturePublicId",
                table: "SiteSettings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SharePictureWidth",
                table: "SiteSettings",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "SiteSettings",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "SharePictureBytes", "SharePictureFormat", "SharePictureHeight", "SharePicturePublicId", "SharePictureWidth" },
                values: new object[] { null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Forward only. Undoing this migration would drop the stored link preview picture record.
            // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
            throw new NotSupportedException(
                "AddSharePicture is forward-only. Undoing it would delete the link preview picture record.");
        }
    }
}
