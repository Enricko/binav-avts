package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250129043638CreateVesselRecordsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250129043638CreateVesselRecordsTable) Signature() string {
	return "20250129043638_create_vessel_records_table"
}

// Up Run the migrations.
func (r *M20250129043638CreateVesselRecordsTable) Up() error {
	if !facades.Schema().HasTable("vessel_records") {
		return facades.Schema().Create("vessel_records", func(table schema.Blueprint) {
			table.ID("id") // Simplified primary key name
			table.String("call_sign", 50) // Added length and index
			table.BigInteger("series_id")

			// Use DOUBLE for latitude and longitude for better precision
			table.String("latitude")
			table.String("longitude")
			table.Double("heading_degree")
			table.Double("speed_in_knots")

			// Enum for GPS quality indicator
			table.Enum("gps_quality_indicator", []any{
				"Fix not valid",
				"GPS fix",
				"Differential GPS fix",
				"Not applicable",
				"RTK Fixed",
				"RTK Float",
				"INS Dead reckoning",
			})

			table.Double("water_depth")

			// Enum for telnet status
			table.Enum("telnet_status", []any{
				"Connected",
				"Disconnected",
			}).Default("Connected")

			// Timestamps and soft deletes
			table.Timestamps()
			table.SoftDeletes()

			// Foreign key constraint
			table.Foreign("call_sign").References("call_sign").On("kapals").CascadeOnDelete()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250129043638CreateVesselRecordsTable) Down() error {
 	return facades.Schema().DropIfExists("vessel_records")
}
