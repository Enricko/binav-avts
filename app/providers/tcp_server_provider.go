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
    tcpService *services.TCPService
}

func (provider *TCPServerProvider) Register(app foundation.Application) {
    fmt.Println("⚡ Registering TCP Server Provider")

    provider.app = app
    provider.tcpService = services.NewTCPService()

    facades.App().Singleton("tcp_service", func(app foundation.Application) (any, error) {
        return provider.tcpService, nil
    })
}

func (provider *TCPServerProvider) Boot(app foundation.Application) {
    fmt.Println("🚀 Booting TCP Server Provider")
    
    // Start service in a goroutine with retry logic
    go func() {
        for {
            err := provider.tcpService.Start()
            if err != nil {
                fmt.Printf("❌ TCP Server Error: %v\n", err)
                fmt.Println("🔄 Retrying in 5 seconds...")
                time.Sleep(5 * time.Second)
                continue
            }
            break
        }
    }()
}