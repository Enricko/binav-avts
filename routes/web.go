package routes

import (
	"goravel/app/http/controllers"

	"github.com/goravel/framework/contracts/route"
	"github.com/goravel/framework/facades"
)

func Web() {

	facades.Route().Static("/public", "./public")
	facades.Route().Static("storage", "./storage/app/public")

	main := controllers.NewController()
	facades.Route().Get("/", main.Index)
	
	auth := controllers.NewAuthController()

	facades.Route().Group(func(r route.Router) {
		r.Post("/auth/login", auth.Login)
		r.Post("/auth/reset-password/request", auth.RequestOTP)
		r.Post("/auth/reset-password/verify", auth.VerifyOTP)
		r.Post("/auth/reset-password/reset", auth.ResetPassword)
	})
	
	facades.Route().Get("/api/vessel/stream-history", (&controllers.VesselRecordController{}).StreamHistory)
	facades.Route().Get("/api/sensors/history/stream", (&controllers.SensorController{}).GetHistorySensorStream)
}
