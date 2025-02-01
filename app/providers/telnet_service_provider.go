package providers

import (
	"fmt"
	"goravel/app/services"
	// "goravel/app/services"

	"github.com/goravel/framework/contracts/foundation"
	"github.com/goravel/framework/facades"
)

type TelnetServiceProvider struct {
	app           foundation.Application
	telnetService *services.TelnetService
}

func (provider *TelnetServiceProvider) Register(app foundation.Application) {
	fmt.Println("Registering TelnetServiceProvider")

	provider.app = app
	provider.telnetService = services.NewTelnetService()

	// Properly bind TelnetService
	facades.App().Singleton("telnet_service", func(app foundation.Application) (any, error) {
		return provider.telnetService, nil
	})
}

func (provider *TelnetServiceProvider) Boot(app foundation.Application) {
	fmt.Println("Booting TelnetServiceProvider")
	err := provider.telnetService.Start()
	if err != nil {
		facades.Log().Error("Failed to start telnet service:", err)
	}
}
