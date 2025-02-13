package controllers

import (
	// "encoding/json"
	"encoding/json"
	// "fmt"
	"goravel/app/models"
	"time"

	nethttp "net/http"
	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
)

type SensorController struct {
	// Dependent services
}

func NewSensorController() *SensorController {
	return &SensorController{
		// Inject services
	}
}

func (r *SensorController) Index(ctx http.Context) http.Response {
	return nil
}

type SensorHistoryRequest struct {
	SensorID  string    `form:"sensor_id" binding:"required"`
	StartTime time.Time `form:"start_time"`
	EndTime   time.Time `form:"end_time"`
}

type SensorRecordData struct {
	ID        uint      `json:"id"`
	IDSensor  string    `json:"id_sensor"`
	RawData   string    `json:"raw_data"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (r *SensorController) GetHistorySensorStream(ctx http.Context) http.Response {
	var request SensorHistoryRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(400, map[string]interface{}{
			"message": "Invalid request parameters",
			"error":   err.Error(),
		})
	}

	// Set response headers for streaming
	writer := ctx.Response().Writer()
	writer.Header().Set("Content-Type", "application/x-ndjson")
	writer.Header().Set("Transfer-Encoding", "chunked")
	writer.WriteHeader(200)

	var lastID uint = 0
	const batchSize = 100 // Smaller batch size for faster streaming

	for {
		var records []models.SensorRecord
		query := facades.Orm().Query().Model(&models.SensorRecord{}).
			Where("id > ?", lastID).
			Where("id_sensor = ?", request.SensorID).
			Order("id ASC").
			Limit(batchSize)

		// Add time range filters if provided
		if !request.StartTime.IsZero() {
			query = query.Where("created_at >= ?", request.StartTime)
		}
		if !request.EndTime.IsZero() {
			query = query.Where("created_at <= ?", request.EndTime)
		}

		err := query.Find(&records)

		if err != nil {
			errorResponse := map[string]interface{}{
				"error":   true,
				"message": "Database query failed",
				"details": err.Error(),
			}
			jsonError, _ := json.Marshal(errorResponse)
			writer.Write(jsonError)
			return nil
		}

		if len(records) == 0 {
			break
		}

		recordBatch := make([]byte, 0, len(records)*256)
		for _, record := range records {
			if record.ID > lastID {
				lastID = record.ID
			}

			recordData := SensorRecordData{
				ID:        record.ID,
				IDSensor:  record.IDSensor,
				RawData:   record.RawData,
				CreatedAt: record.CreatedAt,
				UpdatedAt: record.UpdatedAt,
			}

			jsonData, err := json.Marshal(recordData)
			if err != nil {
				continue
			}

			recordBatch = append(recordBatch, jsonData...)
			recordBatch = append(recordBatch, '\n') // Use newline as record separator
		}

		if len(recordBatch) > 0 {
			writer.Write(recordBatch)
			if f, ok := writer.(nethttp.Flusher); ok {
				f.Flush()
			}
		}

		if len(records) < batchSize {
			break
		}
	}

	return nil
}