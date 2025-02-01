// app/providers/websocket_service_provider.go

package providers

import (
	"fmt"
	"goravel/app/services"

	"github.com/goravel/framework/contracts/foundation"
	"github.com/goravel/framework/facades"

	// "github.com/goravel/framework/contracts/http"
)

type WebSocketServiceProvider struct {
	app            foundation.Application
	wsService      *services.TelnetWebSocketService
	telnetProvider *TelnetServiceProvider
}

func (provider *WebSocketServiceProvider) Register(app foundation.Application) {
	fmt.Println("Registering WebSocketServiceProvider")
	provider.app = app

	// Retrieve the TelnetService from the container
	telnetServiceInterface, err := facades.App().Make("telnet_service")
	if err != nil {
		panic(fmt.Sprintf("Failed to retrieve TelnetService: %v", err))
	}

	telnetService, ok := telnetServiceInterface.(*services.TelnetService)
	if !ok || telnetService == nil {
		panic("TelnetService is nil or type assertion failed")
	}

	// Initialize the WebSocket service
	provider.wsService = services.NewTelnetWebSocketService(telnetService)

	// ✅ Correct way to bind the service
	facades.App().Bind("websocket_service", func(app foundation.Application) (any, error) {
		return provider.wsService, nil
	})
}

func (provider *WebSocketServiceProvider) Boot(app foundation.Application) {
	// fmt.Println("Booting WebSocketServiceProvider")

	// // Register WebSocket route
	// facades.Route().Get("/ws/vessels", func(ctx http.Context) http.Response {
	// 	err := provider.wsService.HandleConnection(ctx)
	// 	if err != nil {
	// 		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
	// 			"error": err.Error(),
	// 		})
	// 	}
	// 	// For WebSocket connections, we don't actually return a response
	// 	// as the connection is handled by the WebSocket handler
	// 	return nil
	// })
}
