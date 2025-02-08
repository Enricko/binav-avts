package providers

import (
    "fmt"
    "goravel/app/services"
    "time"
    "os"
    "os/signal"
    "syscall"
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

    facades.App().Bind("websocket_service", func(app foundation.Application) (any, error) {
        return provider.wsService, nil
    })

    // Setup graceful shutdown
    go provider.handleShutdown()
}

func (provider *TCPServerProvider) Boot(app foundation.Application) {
    fmt.Println("🚀 Booting TCP Server Provider")
    
    go provider.startVesselServer()
    go provider.startSensorServer()
}

func (provider *TCPServerProvider) startVesselServer() {
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
}

func (provider *TCPServerProvider) startSensorServer() {
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
}

func (provider *TCPServerProvider) handleShutdown() {
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    <-sigChan
    fmt.Println("\n⏳ Shutting down TCP servers...")
    
    if err := provider.tcpVesselService.Stop(); err != nil {
        fmt.Printf("Error stopping vessel service: %v\n", err)
    }
    if err := provider.tcpSensorService.Stop(); err != nil {
        fmt.Printf("Error stopping sensor service: %v\n", err)
    }
    
    fmt.Println("✅ TCP servers shutdown complete")
}