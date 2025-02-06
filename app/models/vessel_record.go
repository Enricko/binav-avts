package models

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

type GpsQuality string
type TelnetStatus string

const (
	Connected    TelnetStatus = "Connected"
	Disconnected TelnetStatus = "Disconnected"
)

const (
	FixNotValid        GpsQuality = "Fix not valid"
	GpsFix             GpsQuality = "GPS fix"
	DifferentialGpsFix GpsQuality = "Differential GPS fix"
	NotApplicable      GpsQuality = "Not applicable"
	RtkFixed           GpsQuality = "RTK Fixed"
	RtkFloat           GpsQuality = "RTK Float"
	InsDeadReckoning   GpsQuality = "INS Dead reckoning"
)

type VesselRecord struct {
	ID uint64 `gorm:"primary_key" json:"id"`
	CallSign       string `gorm:"not null;index" json:"call_sign" binding:"required"`
	SeriesID       uint64 `gorm:"not null" json:"series_id" binding:"required"`

	Latitude            string       `gorm:"varchar(255)" json:"latitude" binding:"required"`
	Longitude           string       `gorm:"varchar(255)" json:"longitude" binding:"required"`
	HeadingDegree       float64      `gorm:"varchar(255)" json:"heading_degree" binding:"required"`
	SpeedInKnots        float64      `gorm:"" json:"speed_in_knots" binding:"required"`
	GpsQualityIndicator GpsQuality   `gorm:"type:enum('Fix not valid','GPS fix','Differential GPS fix','Not applicable','RTK Fixed','RTK Float','INS Dead reckoning');" json:"gps_quality_indicator"`
	WaterDepth          float64      `gorm:"" json:"water_depth" binding:"required"`
	TelnetStatus        TelnetStatus `gorm:"type:enum('Connected','Disconnected');default:'Connected'" json:"telnet_status" binding:"required"`

	CreatedAt time.Time  `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"type:datetime" json:"-"`
	DeletedAt *time.Time `gorm:"index" json:"-"`

	Kapal *Kapal `gorm:"foreignKey:CallSign;references:CallSign;constraint:OnDelete:NO ACTION" json:"-"`
}

func StringToGpsQuality(value string) (GpsQuality, error) {
	fmt.Println(value)
	switch value {
	case string(FixNotValid):
		return FixNotValid, nil
	case string(GpsFix):
		return GpsFix, nil
	case string(DifferentialGpsFix):
		return DifferentialGpsFix, nil
	case string(NotApplicable):
		return NotApplicable, nil
	case string(RtkFixed):
		return RtkFixed, nil
	case string(RtkFloat):
		return RtkFloat, nil
	case string(InsDeadReckoning):
		return InsDeadReckoning, nil
	default:
		return "", errors.New("invalid GpsQuality value")
	}
}

func ParseCoordinate(coord string) (float64, string) {
	parts := strings.Split(strings.ReplaceAll(coord, "°", " "), " ")
	if len(parts) < 3 {
		return 0, ""
	}

	degrees, _ := strconv.ParseFloat(parts[0], 64)
	minutes, _ := strconv.ParseFloat(parts[1], 64)
	direction := parts[2]

	decimal := degrees + minutes/60
	if direction == "S" || direction == "W" {
		decimal = -decimal
	}

	dms := fmt.Sprintf("%d°%g'%s", int(degrees), minutes, direction)

	return decimal, dms
}

func CalculateFuelEfficiency(speedInKnots float64, min float64, max float64) float64 {
	if speedInKnots <= 0 {
		return 0
	}
	efficiency := (speedInKnots + min + max) / 3
	return math.Round(efficiency*100) / 100
}

func GetFuelEfficiencyStatus(current, min, max float64) string {
	if current <= 0 {
		return "Stopped"
	}

	midpoint := (min + max) / 2

	if current >= max {
		return "Efficient"
	} else if current >= midpoint {
		return "Normal"
	} else if current >= min {
		return "Below Normal"
	}

	return "Inefficient"
}
