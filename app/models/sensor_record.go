package models

import (
	"github.com/goravel/framework/database/orm"
)

type SensorRecord struct {
	orm.Model
	IDSensor string  `json:"id_sensor" gorm:"column:id_sensor"`
	RawData  string  `json:"raw_data"`
	Sensor   *Sensor `json:"sensor" gorm:"foreignKey:IDSensor;references:ID"`
}
