package models

import (
	"time"

	"github.com/goravel/framework/contracts/database/orm"
)

type TelnetRecord struct {
    ID        uint      `gorm:"primarykey"`
    IDTelnet  uint64    `gorm:"column:id_telnet;not null"`
    RawData   string    `gorm:"column:raw_data"`
    CreatedAt time.Time
    UpdatedAt time.Time
	DeletedAt                   *time.Time `gorm:"index" json:"deleted_at"` // Add this field for soft delete

    // Relationship
    TelnetSession *TelnetSession `gorm:"foreignKey:IDTelnet"`
}

// TableName specifies the table name for the model
func (t *TelnetRecord) TableName() string {
    return "telnet_records"
}

// Connection specifies which database connection to use
func (t *TelnetRecord) Connection() string {
    return "mysql"
}

// Define some useful scopes
func ByTelnetSession(telnetID uint64) func(orm.Query) orm.Query {
    return func(query orm.Query) orm.Query {
        return query.Where("id_telnet", telnetID)
    }
}

func BySeriesID(seriesID int64) func(orm.Query) orm.Query {
    return func(query orm.Query) orm.Query {
        return query.Where("series_id", seriesID)
    }
}

func OrderByLatest() func(orm.Query) orm.Query {
    return func(query orm.Query) orm.Query {
        return query.OrderBy("created_at", "DESC")
    }
}