package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250130041936CreateTelnetSessionsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250130041936CreateTelnetSessionsTable) Signature() string {
	return "20250130041936_create_telnet_sessions_table"
}

// Up Run the migrations.
func (r *M20250130041936CreateTelnetSessionsTable) Up() error {
	if !facades.Schema().HasTable("telnet_sessions") {
		return facades.Schema().Create("telnet_sessions", func(table schema.Blueprint) {
			// Primary key
			table.ID()

			// Required fields
			table.String("name", 255)
			table.String("latitude").Nullable().Comment("No Movement Required")
			table.String("longitude").Nullable().Comment("No Movement Required")
			table.Enum("type",[]any{"kapal","fathometer"}).Nullable()
			table.String("call_sign").Nullable().Comment("Kapal's Call Sign ONLY")
			table.Enum("type_ip", []any{"all", "gga", "hdt", "vtg", "depth"}).Nullable().Comment("For Kapals/Depth Ocean Only")
			table.String("ip", 16)
			table.UnsignedSmallInteger("port")

			// Timestamps
			table.Timestamps()
			// Soft Delete
			table.SoftDeletes()

			// Foreign key
			table.Foreign("call_sign").References("call_sign").On("kapals").CascadeOnDelete()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250130041936CreateTelnetSessionsTable) Down() error {
	return facades.Schema().DropIfExists("telnet_sessions")
}
