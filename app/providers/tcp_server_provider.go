package providers

import (
	"fmt"
	"goravel/app/services"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/goravel/framework/contracts/foundation"
	"github.com/goravel/framework/facades"
)

// TCPServerProvider manages all TCP-related services
type TCPServerProvider struct {
    app              foundation.Application
    tcpVesselService *services.TCPVesselService
    tcpSensorService *services.TCPSensorService
    wsService        *services.WebSocketService
    shutdownChan     chan os.Signal
}

// Register initializes and registers the TCP services
func (provider *TCPServerProvider) Register(app foundation.Application) {
    fmt.Println("⚡ Registering TCP Server Provider")
    provider.app = app
    provider.tcpVesselService = services.NewTCPVesselService()
    provider.tcpSensorService = services.NewTCPSensorService()
    provider.wsService = services.NewWebSocketService(provider.tcpVesselService, provider.tcpSensorService)
    provider.shutdownChan = make(chan os.Signal, 1)

    // Register services in the application container
    facades.App().Singleton("tcp_navigation_service", func(app foundation.Application) (any, error) {
        return provider.tcpVesselService, nil
    })

    facades.App().Singleton("tcp_sensor_service", func(app foundation.Application) (any, error) {
        return provider.tcpSensorService, nil
    })

    facades.App().Singleton("websocket_service", func(app foundation.Application) (any, error) {
        return provider.wsService, nil
    })

    // Setup graceful shutdown
    signal.Notify(provider.shutdownChan, syscall.SIGINT, syscall.SIGTERM)
    go provider.handleShutdown()
}

// Boot starts the TCP services after application initialization
func (provider *TCPServerProvider) Boot(app foundation.Application) {
    fmt.Println("🚀 Booting TCP Server Provider")
    
    // Start services in separate goroutines for parallel initialization
    go provider.startVesselServer()
    go provider.startSensorServer()
}

// startVesselServer starts the vessel TCP server with retry logic
func (provider *TCPServerProvider) startVesselServer() {
    maxRetries := 5
    retryCount := 0
    retryDelay := 5 * time.Second

    for retryCount < maxRetries {
        err := provider.tcpVesselService.Start()
        if err != nil {
            retryCount++
            facades.Log().Error(fmt.Sprintf("❌ TCP Navigation Server Error: %v (Retry %d/%d)", 
                err, retryCount, maxRetries))
            
            if retryCount < maxRetries {
                facades.Log().Info(fmt.Sprintf("🔄 Retrying in %v...", retryDelay))
                time.Sleep(retryDelay)
                // Exponential backoff with a cap
                if retryDelay < 30*time.Second {
                    retryDelay = retryDelay * 2
                }
                continue
            }
            
            facades.Log().Error("❌ Failed to start TCP Vessel Server after maximum retries")
            return
        }
        
        facades.Log().Info("✅ TCP Vessel Server started successfully")
        break
    }
}

// startSensorServer starts the sensor TCP server with retry logic
func (provider *TCPServerProvider) startSensorServer() {
    maxRetries := 5
    retryCount := 0
    retryDelay := 5 * time.Second

    for retryCount < maxRetries {
        err := provider.tcpSensorService.Start()
        if err != nil {
            retryCount++
            facades.Log().Error(fmt.Sprintf("❌ TCP Sensor Server Error: %v (Retry %d/%d)", 
                err, retryCount, maxRetries))
            
            if retryCount < maxRetries {
                facades.Log().Info(fmt.Sprintf("🔄 Retrying in %v...", retryDelay))
                time.Sleep(retryDelay)
                // Exponential backoff with a cap
                if retryDelay < 30*time.Second {
                    retryDelay = retryDelay * 2
                }
                continue
            }
            
            facades.Log().Error("❌ Failed to start TCP Sensor Server after maximum retries")
            return
        }
        
        facades.Log().Info("✅ TCP Sensor Server started successfully")
        break
    }
}

// handleShutdown manages graceful shutdown of all services
func (provider *TCPServerProvider) handleShutdown() {
    <-provider.shutdownChan
    fmt.Println("\n⏳ Shutting down TCP servers...")
    
    // Create a channel to signal completion of shutdown
    done := make(chan struct{})
    
    go func() {
        // Stop all services concurrently
        var vesselErr, sensorErr error
        
        // Use wait group to manage concurrent shutdowns
        var wg sync.WaitGroup
        wg.Add(2)
        
        // Stop vessel service
        go func() {
            defer wg.Done()
            vesselErr = provider.tcpVesselService.Stop()
            if vesselErr != nil {
                facades.Log().Error(fmt.Sprintf("Error stopping vessel service: %v", vesselErr))
            } else {
                facades.Log().Info("Vessel service stopped successfully")
            }
        }()
        
        // Stop sensor service  
        go func() {
            defer wg.Done()
            sensorErr = provider.tcpSensorService.Stop() 
            if sensorErr != nil {
                facades.Log().Error(fmt.Sprintf("Error stopping sensor service: %v", sensorErr))
            } else {
                facades.Log().Info("Sensor service stopped successfully")
            }
        }()
        
        // Wait for all services to stop
        wg.Wait()
        close(done)
    }()
    
    // Wait for shutdown with timeout
    select {
    case <-done:
        fmt.Println("✅ TCP servers shutdown complete")
    case <-time.After(10 * time.Second):
        fmt.Println("⚠️ TCP servers shutdown timed out after 10 seconds")
    }
    
    // Additional cleanup if needed
    os.Exit(0)
}