package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// SensorType defines valid sensor types
type SensorType string

// Predefined sensor types
const (
	TypeTide    SensorType = "tide"
	TypeWeather SensorType = "weather"
	// Add more sensor types as needed
	TypeWater   SensorType = "water"
	TypePollution SensorType = "pollution"
	TypeCurrent SensorType = "current"
)

// AllSensorTypes contains all valid sensor types for validation
var AllSensorTypes = map[SensorType]bool{
	TypeTide:      true,
	TypeWeather:   true,
	TypeWater:     true,
	TypePollution: true,
	TypeCurrent:   true,
	// Add new types here as well
}

// StringArray represents an array of strings stored as JSON in the database
type StringArray []string

// Scan implements the sql.Scanner interface for StringArray
func (a *StringArray) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, a)
}

// Value implements the driver.Valuer interface for StringArray
func (a StringArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

// Sensor represents a sensor device in the system
type Sensor struct {
	ID        string      `json:"id" gorm:"primaryKey"`
	Types     StringArray `json:"types" gorm:"type:json"`
	Latitude  string      `json:"latitude"`
	Longitude string      `json:"longitude"`
	CreatedAt time.Time   `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time   `gorm:"type:datetime" json:"updated_at"`
	DeletedAt *time.Time  `gorm:"index" json:"deleted_at"`
}

// Validate checks if the sensor data is valid
func (s *Sensor) Validate() error {
	// Validate sensor types
	if len(s.Types) == 0 {
		return errors.New("sensor must have at least one type")
	}

	// Check that all types are valid
	for _, t := range s.Types {
		if !AllSensorTypes[SensorType(t)] {
			return fmt.Errorf("invalid sensor type: %s", t)
		}
	}

	return nil
}

// HasType checks if the sensor has a specific type
func (s *Sensor) HasType(sensorType string) bool {
	for _, t := range s.Types {
		if t == sensorType {
			return true
		}
	}
	return false
}

// HasAnyType checks if the sensor has any of the given types
func (s *Sensor) HasAnyType(sensorTypes ...string) bool {
	for _, requestedType := range sensorTypes {
		if s.HasType(requestedType) {
			return true
		}
	}
	return false
}

// HasAllTypes checks if the sensor has all of the given types
func (s *Sensor) HasAllTypes(sensorTypes ...string) bool {
	for _, requestedType := range sensorTypes {
		if !s.HasType(requestedType) {
			return false
		}
	}
	return true
}

// AddType adds a new type to the sensor if it doesn't already have it
func (s *Sensor) AddType(sensorType string) error {
	// Validate the type
	if !AllSensorTypes[SensorType(sensorType)] {
		return fmt.Errorf("invalid sensor type: %s", sensorType)
	}

	// Check if type already exists
	if s.HasType(sensorType) {
		return nil // Type already exists, no need to add
	}

	// Add the new type
	s.Types = append(s.Types, sensorType)
	return nil
}

// RemoveType removes a type from the sensor
func (s *Sensor) RemoveType(sensorType string) {
	var newTypes StringArray
	for _, t := range s.Types {
		if t != sensorType {
			newTypes = append(newTypes, t)
		}
	}
	s.Types = newTypes
}

// GetSupportedTypes returns a list of all supported sensor types
func GetSupportedTypes() []string {
	types := make([]string, 0, len(AllSensorTypes))
	for t := range AllSensorTypes {
		types = append(types, string(t))
	}
	return types
}