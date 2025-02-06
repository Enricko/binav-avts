package providers

import (
    // "fmt"
    "goravel/app/services"
    "github.com/goravel/framework/contracts/foundation"
    // "github.com/goravel/framework/facades"
    // "github.com/goravel/framework/contracts/http"
)

type WebSocketServiceProvider struct {
    app       foundation.Application
    wsService *services.WebSocketService
}

func (provider *WebSocketServiceProvider) Register(app foundation.Application) {
    // provider.app = app

    // // Initialize WebSocket service
	// tcpService := services.NewTCPVesselService()
    // provider.wsService = services.NewWebSocketService(tcpService)

    // // Bind service to container
    // facades.App().Bind("websocket_service", func(app foundation.Application) (any, error) {
    //     return provider.wsService, nil
    // })
}

func (provider *WebSocketServiceProvider) Boot(app foundation.Application) {
    // fmt.Println("Booting WebSocketServiceProvider")

    // // Register WebSocket route
    // facades.Route().Get("/ws/vessels", func(ctx http.Context) http.Response {
    //     err := provider.wsService.HandleConnection(ctx)
    //     if err != nil {
    //         return ctx.Response().Json(http.StatusInternalServerError, http.Json{
    //             "error": err.Error(),
    //         })
    //     }
    //     return nil
    // })
}