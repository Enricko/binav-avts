package models

import (
	"time"
)

type TypeIP string

const (
	ALL   TypeIP = "all"
	GGA   TypeIP = "gga"
	HDT   TypeIP = "hdt"
	VTG   TypeIP = "vtg"
	DEPTH TypeIP = "depth"
)

type IPKapal struct {
	ID uint      `gorm:"primary_key" json:"id"`
	CallSign  string    `gorm:"not null;index" json:"call_sign" binding:"required"`
	TypeIP    TypeIP    `gorm:"type:enum('all','gga','hdt','vtg','depth');not null" json:"type_ip" binding:"required"`
	IP        string    `gorm:"type:varchar(16);not null;" json:"ip" binding:"required"`
	Port      uint16    `json:"port" binding:"required"`
	CreatedAt time.Time `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:datetime" json:"updated_at"`
	Kapal     *Kapal    `gorm:"foreignKey:CallSign;association_foreignkey:CallSign"`
}
