package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250202155431CreateGeolayersTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250202155431CreateGeolayersTable) Signature() string {
	return "20250202155431_create_geolayers_table"
}

// Up Run the migrations.
func (r *M20250202155431CreateGeolayersTable) Up() error {
	if !facades.Schema().HasTable("geolayers") {
		return facades.Schema().Create("geolayers", func(table schema.Blueprint) {
			table.ID()
			table.String("name", 255)
			table.String("file_path", 255)
			table.String("file_type", 50)  // gpkg, shp, etc.
			table.String("workspace", 100)  // GeoServer workspace
			table.String("store_name", 100) // GeoServer datastore name
			table.String("layer_name", 100) // GeoServer layer name
			table.Text("bbox").Nullable()   // Bounding box
			table.Timestamps()
			table.SoftDeletes()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250202155431CreateGeolayersTable) Down() error {
 	return facades.Schema().DropIfExists("geolayers")
}
