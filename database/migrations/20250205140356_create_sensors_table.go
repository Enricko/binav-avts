package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250205140356CreateSensorsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250205140356CreateSensorsTable) Signature() string {
	return "20250205140356_create_sensors_table"
}

// Up Run the migrations.
func (r *M20250205140356CreateSensorsTable) Up() error {
	if !facades.Schema().HasTable("sensors") {
		return facades.Schema().Create("sensors", func(table schema.Blueprint) {
			table.String("id", 50)
			table.Primary("id")
			table.Json("types").Comment("Array of sensor types: tide, weather, etc")
			table.String("latitude").Nullable().Comment("No Movement Required")
			table.String("longitude").Nullable().Comment("No Movement Required")
			table.Timestamps()
			table.SoftDeletes()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250205140356CreateSensorsTable) Down() error {
	return facades.Schema().DropIfExists("sensors")
}
