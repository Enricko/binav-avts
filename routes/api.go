package routes

import (
	// "fmt"

	// "github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/contracts/route"
	"github.com/goravel/framework/facades"

	"goravel/app/http/controllers"
)

func Api() {
	userController := controllers.NewUserController()
	facades.Route().Get("/users/{id}", userController.Show)

	kapalController := controllers.NewKapalController()
	sensorController := controllers.NewSensorController()


	// Geolayer controller
	geolayerController := controllers.NewGeolayerController()
	
	// Define routes using the flat approach that works
	facades.Route().Get("/api/geolayers", geolayerController.Index)
	
	facades.Route().Post("/api/geolayers", geolayerController.Store)
	
	facades.Route().Get("/api/geolayers/{id}", geolayerController.Show)
	facades.Route().Put("/api/geolayers/{id}", geolayerController.Update)
	facades.Route().Delete("/api/geolayers/{id}", geolayerController.Destroy)
	
	// Additional endpoints
	facades.Route().Put("/api/geolayers/{id}/restore", geolayerController.Restore)
	facades.Route().Delete("/api/geolayers/{id}/force", geolayerController.ForceDestroy)
	
	// Management view (if needed)
	facades.Route().Get("/api/geolayers/view", geolayerController.View)
	
    // API endpoints

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

		// Sensor routes
		router.Prefix("sensor").Group(func(sensor route.Router) {
			// Metadata endpoints
			sensor.Get("/types", sensorController.GetSensorTypes)
			sensor.Get("/statistics", sensorController.GetStatistics)

			// Core CRUD operations
			sensor.Get("/", sensorController.Index)
			sensor.Get("/view", sensorController.View)
			sensor.Get("/{id}", sensorController.Show)
			sensor.Post("/", sensorController.Store)
			sensor.Post("/{id}", sensorController.Update)
			sensor.Delete("/{id}", sensorController.Destroy)
			sensor.Put("/{id}/restore", sensorController.Restore)

			// Type management endpoints
			sensor.Post("/{id}/type", sensorController.AddType)      // Add a type to a sensor
			sensor.Delete("/{id}/type", sensorController.RemoveType) // Remove a type from a sensor

			// Sensor history streaming endpoint
			sensor.Get("/history", sensorController.GetHistorySensorStream)
		})

		// router.Prefix("geolayer").Group(func(geolayer route.Router) {
		// 	// geolayer.Get("/view", geolayerController.View)

		// 	// Standard REST endpoints
		// 	geolayer.Get("/", geolayerController.Index)
		// 	// geolayer.Get("/{id}", geolayerController.Show)
		// 	geolayer.Post("/", geolayerController.Store)
		// 	// geolayer.Put("/{id}", geolayerController.Update)
		// 	geolayer.Delete("/{id}", geolayerController.Destroy)

		// 	// Additional endpoints for restoration and permanent deletion
		// 	// geolayer.Put("/{id}/restore", geolayerController.Restore)
		// 	// geolayer.Delete("/{id}/force", geolayerController.ForceDestroy)
		// })
		// API endpoints
	})
}
