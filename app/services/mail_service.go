// app/services/mail_service.go
package services

import (
	"bytes"
	"encoding/base64"
	"goravel/app/models"
	"html/template"
	"os"
	"path/filepath"

	"github.com/goravel/framework/contracts/mail"
	"github.com/goravel/framework/facades"
)

type MailService struct {}

func NewMailService() *MailService {
    return &MailService{}
}

func (s *MailService) SendResetPasswordEmail(user models.User, otp string) error {
    // Get template path
    templatePath := filepath.Join("resources", "views", "emails", "reset_password.html")
    
    // Read logo
    logoPath := filepath.Join("public", "assets", "images", "logo_transparent.png")
    logoData, err := os.ReadFile(logoPath)
    if err != nil {
        return err
    }
    logoBase64 := base64.StdEncoding.EncodeToString(logoData)
    
    // Parse template
    tmpl, err := template.ParseFiles(templatePath)
    if err != nil {
        return err
    }

    // Prepare data for template
    data := map[string]interface{}{
        "LogoUrl":     "data:image/png;base64," + logoBase64,
        "Name":        user.Name,
        "OTP":         otp,
        "CompanyName": "Binav AVTS",
        "CompanyUrl":  "https://binav-avts.id",
    }

    // Execute template
    var body bytes.Buffer
    if err := tmpl.Execute(&body, data); err != nil {
        return err
    }

    // Send email
    return facades.Mail().To([]string{user.Email}).
        Subject("Password Reset Request").
        Content(mail.Content{
            Html: body.String(),
        }).
        Send()
}