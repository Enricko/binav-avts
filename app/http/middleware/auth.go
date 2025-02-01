// app/http/middleware/auth_middleware.go
package middleware

import (
	"goravel/app/services"

	"github.com/goravel/framework/contracts/http"
)

func Auth() http.Middleware {
    return func(ctx http.Context) {
        token := ctx.Request().Header("Authorization")
        if token == "" {
            ctx.Response().Json(http.StatusUnauthorized, "Unauthorized")
            return
        }

        jwtService := services.NewJwtService()
        _, err := jwtService.ValidateToken(token)
        if err != nil {
            ctx.Response().Json(http.StatusUnauthorized, "Invalid token")
            return
        }

        ctx.Request().Next()
    }
}