package models

import (
	"time"

	"github.com/goravel/framework/database/orm"
)

type Geolayer struct {
	orm.Model
	Name      string `json:"name" gorm:"column:name"`
	FilePath  string `json:"file_path" gorm:"column:file_path"`
	FileType  string `json:"file_type" gorm:"column:file_type"`
	Workspace string `json:"workspace" gorm:"column:workspace"`
	StoreName string `json:"store_name" gorm:"column:store_name"`
	LayerName string `json:"layer_name" gorm:"column:layer_name"`
	Bbox      string `json:"bbox" gorm:"column:bbox"`

	CreatedAt time.Time  `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"type:datetime" json:"updated_at"`
	DeletedAt *time.Time `gorm:"index" json:"deleted_at"` // Add this field for soft delete
}
