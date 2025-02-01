package controllers

import (
	"goravel/app/models"
	"goravel/app/services"
	"math/rand"
	"strconv"
	"time"

	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
)

type AuthController struct {
	jwt  *services.JwtService
	mail *services.MailService
}

func NewAuthController() *AuthController {
	return &AuthController{
		jwt:  services.NewJwtService(),
		mail: services.NewMailService(),
	}
}

func (r *AuthController) Login(ctx http.Context) http.Response {
	var request models.User
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid request",
			"errors":  err.Error(),
		})
	}

	validator, err := facades.Validation().Make(map[string]any{
		"email":    request.Email,
		"password": request.Password,
	}, map[string]string{
		"email":    "required|email",
		"password": "required|min_len:6",
	})

	if err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation error",
			"errors":  err.Error(),
		})
	}

	if validator.Fails() {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation failed",
			"errors":  validator.Errors().All(),
		})
	}

	// Find user
	var user models.User
	if err := facades.Orm().Query().Where("email", request.Email).First(&user); err != nil {
		return ctx.Response().Json(http.StatusUnauthorized, http.Json{
			"message": "Invalid credentials",
		})
	}

	// Check password
	if !services.CheckPasswordHash(request.Password, user.Password) {
		return ctx.Response().Json(http.StatusUnauthorized, http.Json{
			"message": "Invalid credentials",
		})
	}

	// Generate token
	token, err := r.jwt.GenerateToken(user)
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Error generating token",
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Login successful",
		"token":   token,
		"user": map[string]interface{}{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"level": user.Level,
		},
	})
}
func (r *AuthController) RequestOTP(ctx http.Context) http.Response {
	var request models.User
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid request",
			"errors":  err.Error(),
		})
	}


	validator, err := facades.Validation().Make(map[string]any{
		"email": request.Email,
	}, map[string]string{
		"email": "required|email",
	})

	if err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation error",
			"errors":  err.Error(),
		})
	}

	if validator.Fails() {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation failed",
			"errors":  validator.Errors().All(),
		})
	}

	var user models.User
	// Try different query approach
	err = facades.Orm().Query().Model(&models.User{}).
		Where("email", request.Email).
		First(&user)

	if err != nil {
		return ctx.Response().Json(http.StatusNotFound, http.Json{
			"message": "User not found",
			"error":   err.Error(), // Add this line to see the actual error
		})
	}

	// Generate OTP
	otp := strconv.Itoa(100000 + rand.Intn(899999))
	expiry := time.Now().Add(15 * time.Minute)

	// Save OTP to user
	user.ResetOTP = otp
	user.ResetOTPExpiry = expiry
	if err := facades.Orm().Query().Save(&user); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Error saving OTP",
			"error":   err.Error(),
		})
	}

	// Send OTP email
	if err := r.mail.SendResetPasswordEmail(user, otp); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Error sending email",
			"error":   err.Error(),
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "OTP sent successfully",
	})
}

func (r *AuthController) VerifyOTP(ctx http.Context) http.Response {
	var request struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}

	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid request",
			"errors":  err.Error(),
		})
	}

	validator, err := facades.Validation().Make(map[string]any{
		"email": request.Email,
		"otp":   request.OTP,
	}, map[string]string{
		"email": "required|email",
		"otp":   "required|len:6",
	})

	if err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation error",
			"errors":  err.Error(),
		})
	}

	if validator.Fails() {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation failed",
			"errors":  validator.Errors().All(),
		})
	}

	var user models.User
	if err := facades.Orm().Query().Where("email", request.Email).First(&user); err != nil {
		return ctx.Response().Json(http.StatusNotFound, http.Json{
			"message": "User not found",
		})
	}

	if user.ResetOTP != request.OTP {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid OTP",
		})
	}

	if time.Now().After(user.ResetOTPExpiry) {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "OTP expired",
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "OTP verified successfully",
	})
}

func (r *AuthController) ResetPassword(ctx http.Context) http.Response {
	var request struct {
		Email              string `json:"email"`
		OTP                string `json:"otp"`
		NewPassword        string `json:"new_password"`
		ConfirmNewPassword string `json:"confirm_new_password"`
	}

	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid request",
			"errors":  err.Error(),
		})
	}

	validator, err := facades.Validation().Make(map[string]any{
		"email":                request.Email,
		"otp":                  request.OTP,
		"new_password":         request.NewPassword,
		"confirm_new_password": request.ConfirmNewPassword,
	}, map[string]string{
		"email":                "required|email",
		"otp":                  "required|len:6",
		"new_password":         "required|min_len:6",
		"confirm_new_password": "required|min_len:6|same:new_password",
	})

	if err != nil {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation error",
			"errors":  err.Error(),
		})
	}

	if validator.Fails() {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Validation failed",
			"errors":  validator.Errors().All(),
		})
	}

	var user models.User
	if err := facades.Orm().Query().Where("email", request.Email).First(&user); err != nil {
		return ctx.Response().Json(http.StatusNotFound, http.Json{
			"message": "User not found",
		})
	}

	if user.ResetOTP != request.OTP {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "Invalid OTP",
		})
	}

	if time.Now().After(user.ResetOTPExpiry) {
		return ctx.Response().Json(http.StatusBadRequest, http.Json{
			"message": "OTP expired",
		})
	}

	// Hash new password
	hashedPassword, err := services.HashPassword(request.NewPassword)
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Error hashing password",
		})
	}

	// Update user password and clear OTP
	user.Password = hashedPassword
	user.ResetOTP = ""
	user.ResetOTPExpiry = time.Time{}

	if err := facades.Orm().Query().Save(&user); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, http.Json{
			"message": "Error saving new password",
		})
	}

	return ctx.Response().Json(http.StatusOK, http.Json{
		"message": "Password reset successfully",
	})
}
