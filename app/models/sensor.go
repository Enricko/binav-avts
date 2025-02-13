package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type StringArray []string

func (a *StringArray) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, a)
}

func (a StringArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

type Sensor struct {
	ID        string      `json:"id" gorm:"primaryKey"`
	Types     StringArray `json:"types" gorm:"type:json"`
	Latitude  string      `json:"latitude"`
	Longitude string      `json:"longitude"`
	CreatedAt time.Time   `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time   `gorm:"type:datetime" json:"updated_at"`
	DeletedAt *time.Time  `gorm:"index" json:"deleted_at"`
}

func (s *Sensor) HasType(sensorType string) bool {
	for _, t := range s.Types {
		if t == sensorType {
			return true
		}
	}
	return false
}
