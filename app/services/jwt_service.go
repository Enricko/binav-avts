package services

import (
	"goravel/app/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/goravel/framework/facades"
)

type JwtService struct {
    secretKey string
}

func NewJwtService() *JwtService {
	config := facades.Config()
    return &JwtService{
        secretKey: config.Env("JWT_SECRET").(string),
    }
}

func (s *JwtService) GenerateToken(user models.User) (string, error) {
    claims := jwt.MapClaims{
        "id":    user.ID,
        "email": user.Email,
        "level": user.Level,
        "exp":   time.Now().Add(time.Hour * 24).Unix(),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.secretKey))
}

func (s *JwtService) ValidateToken(tokenString string) (*jwt.Token, error) {
    return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, jwt.ErrSignatureInvalid
        }
        return []byte(s.secretKey), nil
    })
}