package models

import (
	"time"

	"github.com/goravel/framework/database/orm"
)

type SensorRecord struct {
	orm.Model
	IDSensor string  `json:"id_sensor" gorm:"column:id_sensor"`
	RawData  string  `json:"raw_data"`
	Sensor   *Sensor `json:"sensor" gorm:"foreignKey:IDSensor;references:ID"`

	CreatedAt time.Time  `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"type:datetime" json:"updated_at"`
	DeletedAt *time.Time `gorm:"index" json:"deleted_at"`
}
