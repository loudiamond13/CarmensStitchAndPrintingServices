using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TurnOnReadCommittedSnapshot : Migration
    {
        // SQL Server refuses this change inside a transaction. The value check makes a second run a no-op.
        // CURRENT is only the database being migrated. ROLLBACK IMMEDIATE ends other sessions' open work on it so the change does not wait.
        private const string TurnOn =
            "IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()) = 0 ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;";

        private const string TurnOff =
            "IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()) = 1 ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT OFF WITH ROLLBACK IMMEDIATE;";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(TurnOn, suppressTransaction: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(TurnOff, suppressTransaction: true);
        }
    }
}
