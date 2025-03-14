package models

import "time"

type Mapping struct {
	ID uint `gorm:"primary_key" json:"id"`

	Name       string    `gorm:"varchar(255);not null;" json:"name" binding:"required"`
	File       string    `gorm:"type:TEXT;not null;" json:"file" binding:"required"`
	Status     bool      `gorm:"not_null" json:"status" binding:"required"`
	CreatedAt time.Time `gorm:"type:datetime" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:datetime" json:"updated_at"`

}