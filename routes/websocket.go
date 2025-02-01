package routes

import (
	"github.com/goravel/framework/facades"
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

func WebSocket() {
	// Resolve WebSocket Service from App Container
	wsService, err := facades.App().Make("websocket_service")
	if err != nil {
		panic("Failed to retrieve WebSocketService: " + err.Error())
	}

	telnetWS, ok := wsService.(*services.TelnetWebSocketService)
	if !ok {
		panic("WebSocketService type assertion failed")
	}

	// Register WebSocket route with a wrapped handler
	facades.Route().Get("/ws", func(ctx http.Context) http.Response {
		err := telnetWS.HandleConnection(ctx)
		if err != nil {
			return ctx.Response().Json(500, map[string]string{"error": err.Error()})
		}
		return nil
	})
}
