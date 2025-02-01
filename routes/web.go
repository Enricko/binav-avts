package routes

import (
	"goravel/app/http/controllers"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
	"github.com/goravel/framework/support"
	"github.com/goravel/framework/contracts/route"
)

func Web() {

	facades.Route().Get("/", func(ctx http.Context) http.Response {
		return ctx.Response().View().Make("welcome.tmpl", map[string]any{
			"version": support.Version,
		})
	})
	auth := controllers.NewAuthController()

    facades.Route().Group(func(r route.Router) {
        r.Post("/auth/login", auth.Login)
        r.Post("/auth/reset-password/request", auth.RequestOTP)
        r.Post("/auth/reset-password/verify", auth.VerifyOTP)
        r.Post("/auth/reset-password/reset", auth.ResetPassword)
    })

	facades.Route().Get("/api/vessel/stream-history", (&controllers.VesselRecordController{}).StreamHistory)
	
}
