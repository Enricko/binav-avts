package models

import (
	"time"

	"github.com/goravel/framework/contracts/database/orm"
)

type TelnetSession struct {
	ID        uint    `gorm:"primarykey"`
	Name      string  `gorm:"type:varchar(255);not null"`
	Latitude  *string `gorm:"type:varchar(255);comment:No Movement Required"`
	Longitude *string `gorm:"type:varchar(255);comment:No Movement Required"`
	Type      *string `gorm:"type:enum('kapal','fathometer')"`
	CallSign  *string `gorm:"type:varchar(255);comment:Kapal's Call Sign ONLY"`
	TypeIP    *string `gorm:"type:enum('all','gga','hdt','vtg','depth');comment:For Kapals/Depth Ocean Only"`
	IP        string  `gorm:"type:varchar(16);not null"`
	Port      uint16  `gorm:"type:smallint unsigned;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time `gorm:"index" json:"deleted_at"` // Add this field for soft delete

	// Relationship
	Kapal *Kapal `gorm:"foreignKey:CallSign;references:CallSign;constraint:OnDelete:CASCADE"`
}

func FilterByType(typeValue string) func(orm.Query) orm.Query {
	return func(query orm.Query) orm.Query {
		return query.Where("type", typeValue)
	}
}

// FilterByTypeIP filters monitoring points by type_ip
func FilterByTypeIP(typeIP string) func(orm.Query) orm.Query {
	return func(query orm.Query) orm.Query {
		return query.Where("type_ip", typeIP)
	}
}

// FilterByCallSign filters monitoring points by call_sign
func FilterByCallSign(callSign string) func(orm.Query) orm.Query {
	return func(query orm.Query) orm.Query {
		return query.Where("call_sign", callSign)
	}
}

// SearchByName searches monitoring points by name using LIKE
func SearchByName(name string) func(orm.Query) orm.Query {
	return func(query orm.Query) orm.Query {
		if name != "" {
			return query.Where("name", "LIKE", "%"+name+"%")
		}
		return query
	}
}

// OrderByCreatedAt orders monitoring points by created_at
func OrderByCreatedAt(direction string) func(orm.Query) orm.Query {
	return func(query orm.Query) orm.Query {
		return query.OrderBy("created_at", direction)
	}
}
