package database

import (
	"github.com/goravel/framework/contracts/database/schema"
	"github.com/goravel/framework/contracts/database/seeder"

	"goravel/database/migrations"
	"goravel/database/seeders"
)

type Kernel struct {
}

func (kernel Kernel) Migrations() []schema.Migration {
	return []schema.Migration{
		&migrations.M20240915060148CreateUsersTable{},
		&migrations.M20250129040939CreateKapalsTable{},
		&migrations.M20250129043528CreateMappingsTable{},
		&migrations.M20250129043638CreateVesselRecordsTable{},
		&migrations.M20250130041936CreateTelnetSessionsTable{},
		&migrations.M20250130042025CreateTelnetRecordsTable{},
	}
}

func (kernel Kernel) Seeders() []seeder.Seeder {
	return []seeder.Seeder{
		&seeders.DatabaseSeeder{},
	}
}
