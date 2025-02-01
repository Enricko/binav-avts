package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250129041724CreateIpKapalsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250129041724CreateIpKapalsTable) Signature() string {
	return "20250129041724_create_ip_kapals_table"
}

// Up Run the migrations.
func (r *M20250129041724CreateIpKapalsTable) Up() error {
	if !facades.Schema().HasTable("ip_kapals") {
		return facades.Schema().Create("ip_kapals", func(table schema.Blueprint) {
			// Primary key
			table.ID()

			// Required fields
			table.String("call_sign")
			table.Enum("type_ip", []any{"all", "gga", "hdt", "vtg", "depth"})
			table.String("ip", 16)
			table.UnsignedSmallInteger("port")

			// Timestamps
			table.DateTime("created_at")
			table.DateTime("updated_at")

			// Foreign key
			table.Foreign("call_sign").References("call_sign").On("kapals").CascadeOnDelete()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250129041724CreateIpKapalsTable) Down() error {
	return facades.Schema().DropIfExists("ip_kapals")
}
