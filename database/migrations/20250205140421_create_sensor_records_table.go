package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250205140421CreateSensorRecordsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250205140421CreateSensorRecordsTable) Signature() string {
	return "20250205140421_create_sensor_records_table"
}

// Up Run the migrations.
func (r *M20250205140421CreateSensorRecordsTable) Up() error {
	if !facades.Schema().HasTable("sensor_records") {
		return facades.Schema().Create("sensor_records", func(table schema.Blueprint) {
			table.ID()
			table.String("id_sensor", 50)
			table.Text("raw_data")
			table.Timestamps()
			table.SoftDeletes()

			table.Foreign("id_sensor").References("id").On("sensors").CascadeOnUpdate().CascadeOnDelete()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250205140421CreateSensorRecordsTable) Down() error {
	return facades.Schema().DropIfExists("sensor_records")
}
