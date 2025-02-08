package controllers

import (
	"github.com/goravel/framework/contracts/http"
)

type Controller struct {
	// Dependent services
}

func NewController() *Controller {
	return &Controller{
		// Inject services
	}
}

func (r *Controller) Index(ctx http.Context) http.Response {
	return ctx.Response().View().Make("pages/home.html")
}	
