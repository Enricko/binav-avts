package bootstrap

import (
	"github.com/goravel/framework/facades"
	"github.com/goravel/framework/foundation"
	// "github.com/goravel/gin"

	"goravel/config"
)

func Boot() {
	app := foundation.NewApplication()

		// gin.SetMode(gin.ReleaseMode)
		// gin.DisableBindValidation() // Optional, can improve performance
		
	// Set higher limits in config
	facades.Config().Add("app.max_request_size", 100*1024*1024) // 100MB for maximum request size
	facades.Config().Add("http.max_multipart_memory", 100*1024*1024) // 100MB for multipart memory

	// Bootstrap the application
	app.Boot()

	// Bootstrap the config.
	config.Boot()
}
