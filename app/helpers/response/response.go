// app/helpers/response/response.go

package response

import (
	"encoding/json"

)

type Response struct {
    Status  int         `json:"status"`
    Message string      `json:"message"`
    Error   string      `json:"error,omitempty"`
    Data    interface{} `json:"data,omitempty"`
}

func Success(data interface{}, message string) Response {
    return Response{
        Status:  200,
        Message: message,
        Data:    data,
    }
}

func Error(status int, message string, err string) Response {
    return Response{
        Status:  status,
        Message: message,
        Error:   err,
    }
}

func NotFound(message string) Response {
    return Response{
        Status:  404,
        Message: message,
    }
}

func BadRequest(message string, err string) Response {
    return Response{
        Status:  400,
        Message: message,
        Error:   err,
    }
}

// Helper function for streaming response
func StreamResponse(data interface{}) ([]byte, error) {
    return json.Marshal(data)
}