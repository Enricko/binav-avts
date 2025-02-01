package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250130042025CreateTelnetRecordsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250130042025CreateTelnetRecordsTable) Signature() string {
	return "20250130042025_create_telnet_records_table"
}

// Up Run the migrations.
func (r *M20250130042025CreateTelnetRecordsTable) Up() error {
	if !facades.Schema().HasTable("telnet_records") {
		return facades.Schema().Create("telnet_records", func(table schema.Blueprint) {
			table.ID("id")                // Simplified primary key name
			table.UnsignedBigInteger("id_telnet") // Added length and index

			// Use DOUBLE for latitude and longitude for better precision
			table.String("raw_data")

			// Timestamps and soft deletes
			table.Timestamps()
			table.SoftDeletes()

			// Foreign key constraint
			table.Foreign("id_telnet").References("id").On("telnet_sessions").CascadeOnDelete()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250130042025CreateTelnetRecordsTable) Down() error {
	return facades.Schema().DropIfExists("telnet_records")
}
