package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20250129043528CreateMappingsTable struct {
}

// Signature The unique signature for the migration.
func (r *M20250129043528CreateMappingsTable) Signature() string {
	return "20250129043528_create_mappings_table"
}

// Up Run the migrations.
func (r *M20250129043528CreateMappingsTable) Up() error {
	if !facades.Schema().HasTable("mappings") {
		return facades.Schema().Create("mappings", func(table schema.Blueprint) {
			// Auto-incrementing primary key
		table.ID()

		// Regular columns
		table.String("name", 255)
		table.Text("file")
		table.Boolean("status")

		// Timestamps
		table.Timestamps()
		})
	}

	return nil
}

// Down Reverse the migrations.
func (r *M20250129043528CreateMappingsTable) Down() error {
 	return facades.Schema().DropIfExists("mappings")
}
