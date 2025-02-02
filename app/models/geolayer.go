package models

import (
	"github.com/goravel/framework/database/orm"
)

type Geolayer struct {
	orm.Model
	Name       string
    FilePath   string
    FileType   string
    Workspace  string
    StoreName  string
    LayerName  string
    Bbox       string
}
