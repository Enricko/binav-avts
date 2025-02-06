package routes

import (
    "github.com/goravel/framework/facades"
    "github.com/goravel/framework/contracts/http"
    "goravel/app/services"
)

func WebSocket() {
    wsService, err := facades.App().Make("websocket_service")
    if err != nil {
        panic("Failed to retrieve WebSocketService: " + err.Error())
    }

    ws, ok := wsService.(*services.WebSocketService)
    if !ok {
        panic("WebSocketService type assertion failed")
    }

    facades.Route().Get("/ws", func(ctx http.Context) http.Response {
        err := ws.HandleConnection(ctx)
        if err != nil {
            return ctx.Response().Json(500, map[string]string{"error": err.Error()})
        }
        return nil
    })
}