package routes

import (
	"github.com/goravel/framework/facades"
	"github.com/goravel/framework/contracts/route"

	"goravel/app/http/controllers"
)

func Api() {
	userController := controllers.NewUserController()
	facades.Route().Get("/users/{id}", userController.Show)

	kapalController := controllers.NewKapalController()

	// Define API route group with middleware
	facades.Route().Prefix("api").Group(func(router route.Router) {
		// Add middleware for the entire API group if needed
		// router.Middleware(middleware.Authenticate{})

		// Kapal routes
		router.Prefix("kapal").Group(func(kapal route.Router) {
			// Public routes
			kapal.Get("/", kapalController.Index)
			kapal.Get("/view", kapalController.View)
			kapal.Get("/{call_sign}", kapalController.Show)

			// Protected routes - add auth middleware
			// kapal.Middleware(middleware.Authenticate{}).Group(func(auth http.Router) {
				kapal.Post("/", kapalController.Store)
				kapal.Post("/{call_sign}", kapalController.Update)
				kapal.Delete("/{call_sign}", kapalController.Destroy)
				kapal.Put("/{call_sign}/restore", kapalController.Restore) // Route to restore soft-deleted vessels
			// })
		})

		// Add other API routes here
	})
}
