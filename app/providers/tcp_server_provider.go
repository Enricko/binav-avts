// app/providers/tcp_server_provider.go
package providers

import (
    "fmt"
    "goravel/app/services"
    "time"
    "github.com/goravel/framework/contracts/foundation"
    "github.com/goravel/framework/facades"
)

type TCPServerProvider struct {
    app foundation.Application
    tcpVesselService *services.TCPVesselService
    tcpSensorService *services.TCPSensorService
    wsService *services.WebSocketService
}

func (provider *TCPServerProvider) Register(app foundation.Application) {
    fmt.Println("⚡ Registering TCP Server Provider")

    provider.app = app
    provider.tcpVesselService = services.NewTCPVesselService()
    provider.tcpSensorService = services.NewTCPSensorService()
    provider.wsService = services.NewWebSocketService(provider.tcpVesselService, provider.tcpSensorService)

    facades.App().Singleton("tcp_navigation_service", func(app foundation.Application) (any, error) {
        return provider.tcpVesselService, nil
    })

    facades.App().Singleton("tcp_sensor_service", func(app foundation.Application) (any, error) {
        return provider.tcpSensorService, nil
    })

    // Bind service to container
    facades.App().Bind("websocket_service", func(app foundation.Application) (any, error) {
        return provider.wsService, nil
    })
}

func (provider *TCPServerProvider) Boot(app foundation.Application) {
    fmt.Println("🚀 Booting TCP Server Provider")
    
    // Start service in a goroutine with retry logic
    go func() {
        for {
            err := provider.tcpVesselService.Start()
            if err != nil {
                fmt.Printf("❌ TCP Navigation Server Error: %v\n", err)
                fmt.Println("🔄 Retrying in 5 seconds...")
                time.Sleep(5 * time.Second)
                continue
            }
            break
        }
    }()

    go func() {
        for {
            err := provider.tcpSensorService.Start()
            if err != nil {
                fmt.Printf("❌ TCP Sensor Server Error: %v\n", err)
                fmt.Println("🔄 Retrying in 5 seconds...")
                time.Sleep(5 * time.Second)
                continue
            }
            break
        }
    }()
}