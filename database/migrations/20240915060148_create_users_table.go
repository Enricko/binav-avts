package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/facades"
)

type M20240915060148CreateUsersTable struct {
}

// Signature The unique signature for the migration.
func (r *M20240915060148CreateUsersTable) Signature() string {
	return "20240915060148_create_users_table"
}

// Up Run the migrations.
func (r *M20240915060148CreateUsersTable) Up() error {
	return facades.Schema().Create("users", func(table schema.Blueprint) {
		table.String("id")
		table.Primary("id")
		table.String("name", 300)

		table.String("email")
		table.Unique("email")

		table.String("password", 300)
		table.Enum("level", []any{
			"guest",
			"user",
			"admin",
			"owner",
		})
		table.String("reset_otp")
		table.Timestamp("reset_otp_expiry").UseCurrent().Nullable()
		table.Timestamps()
	})
}

// Down Reverse the migrations.
func (r *M20240915060148CreateUsersTable) Down() error {
	return facades.Schema().DropIfExists("users")
}
