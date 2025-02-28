package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250129040939CreateKapalsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250129040939CreateKapalsTable) Signature() string {
	return "20250129040939_create_kapals_table"
}

// Up Run the migrations.
func (r *M20250129040939CreateKapalsTable) Up() error {
	if !facades.Schema().HasTable("kapals") {
		return facades.Schema().Create("kapals", func(table schema.Blueprint) {
			// Primary Key
			table.String("call_sign", 50)
			table.Primary("call_sign")

			// Regular columns
			table.String("flag", 300)
			table.String("kelas", 300)
			table.String("builder", 300)
			table.UnsignedInteger("year_built")
			table.BigInteger("heading_direction")
			table.BigInteger("calibration")
			table.BigInteger("width_m")
			table.BigInteger("length_m")
			table.BigInteger("bow_to_stern")
			table.BigInteger("port_to_starboard")
			table.Text("image_map")
			table.Text("image")
			table.BigInteger("history_per_second").Default(30)
			table.Double("minimum_knot_per_liter_gasoline")
			table.Double("maximum_knot_per_liter_gasoline")
			table.Boolean("record_status").Default(true)

			// Timestamps
			table.Timestamps()

			// Soft Delete
			table.SoftDeletes()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250129040939CreateKapalsTable) Down() error {
	return facades.Schema().DropIfExists("kapals")
}
