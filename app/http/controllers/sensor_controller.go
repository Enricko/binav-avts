package controllers

import (
	"encoding/json"
	"goravel/app/models"
	"time"

	nethttp "net/http"
	"github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
)

// SensorController handles CRUD operations for sensor data
type SensorController struct {
	// Dependent services
}

// NewSensorController creates a new instance of SensorController
func NewSensorController() *SensorController {
	return &SensorController{}
}


func (c *SensorController) View(ctx http.Context) http.Response {
	// Return the HTML template for the vessel management interface
	return ctx.Response().View().Make("pages/sensor_modal.html")
}

// Index returns a paginated list of all sensors
func (r *SensorController) Index(ctx http.Context) http.Response {
	page := ctx.Request().QueryInt("page", 1)
	perPage := ctx.Request().QueryInt("per_page", 10)
	
	var sensors []models.Sensor
	var total int64
	
	// Build query with search and filter options
	query := facades.Orm().Query().Model(&models.Sensor{})
	
	// Apply search if provided
	if search := ctx.Request().Query("search", ""); search != "" {
		query = query.Where("id LIKE ?", "%"+search+"%")
	}
	
	// Apply type filter if provided
	if sensorType := ctx.Request().Query("type", ""); sensorType != "" {
		// This JSON contains filtering depends on the database
		query = query.Where("JSON_CONTAINS(types, ?)", `"`+sensorType+`"`)
	}
	
	// Handle soft deletes
	if ctx.Request().QueryBool("with_trashed", false) {
		query = query.WithTrashed()
	} else if ctx.Request().QueryBool("only_trashed", false) {
		// Manually filter for only trashed records since OnlyTrashed is not available
		query = query.WhereNotNull("deleted_at")
	}
	
	// Execute count query for pagination
	countQuery := facades.Orm().Query().Model(&models.Sensor{})
	if ctx.Request().QueryBool("with_trashed", false) {
		countQuery = countQuery.WithTrashed()
	} else if ctx.Request().QueryBool("only_trashed", false) {
		countQuery = countQuery.WhereNotNull("deleted_at")
	}
	countQuery.Count(&total)
	
	// Execute paginated query
	err := query.Order("created_at DESC").
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&sensors)
		
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve sensors",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"data": sensors,
		"meta": map[string]interface{}{
			"current_page": page,
			"per_page":     perPage,
			"total":        total,
			"last_page":    (total + int64(perPage) - 1) / int64(perPage),
		},
		"supported_types": models.GetSupportedTypes(),
	})
}

// Show retrieves a specific sensor by ID
func (r *SensorController) Show(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	
	var sensor models.Sensor
	
	query := facades.Orm().Query()
	
	// Check if we should include trashed items
	if ctx.Request().QueryBool("with_trashed", false) {
		query = query.WithTrashed()
	}
	
	err := query.Find(&sensor, id)
	if err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"data": sensor,
		"supported_types": models.GetSupportedTypes(),
	})
}

// SensorRequest defines the request structure for sensor creation/update
type SensorRequest struct {
	ID        string   `form:"id" binding:"required"`
	Types     []string `form:"types" binding:"required"`
	Latitude  string   `form:"latitude"`
	Longitude string   `form:"longitude"`
}

// Store creates a new sensor
func (r *SensorController) Store(ctx http.Context) http.Response {
	var request SensorRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request parameters",
			"errors":  err.Error(),
		})
	}
	
	// Validate ID uniqueness
	var existingSensor models.Sensor
	if err := facades.Orm().Query().WithTrashed().Where("id = ?", request.ID).First(&existingSensor); err == nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Sensor ID already exists",
			"errors": map[string]interface{}{
				"id": []string{"This sensor ID is already taken"},
			},
		})
	}
	
	// Create new sensor
	sensor := models.Sensor{
		ID:        request.ID,
		Types:     request.Types,
		Latitude:  request.Latitude,
		Longitude: request.Longitude,
	}
	
	// Validate sensor data
	if err := sensor.Validate(); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid sensor data",
			"errors": map[string]interface{}{
				"types": []string{err.Error()},
			},
			"supported_types": models.GetSupportedTypes(),
		})
	}
	
	if err := facades.Orm().Query().Create(&sensor); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to create sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusCreated, map[string]interface{}{
		"message": "Sensor created successfully",
		"data":    sensor,
	})
}

// Update modifies an existing sensor
func (r *SensorController) Update(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	
	var request SensorRequest
	if err := ctx.Request().Bind(&request); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request parameters",
			"errors":  err.Error(),
		})
	}
	
	// Find existing sensor
	var sensor models.Sensor
	if err := facades.Orm().Query().Find(&sensor, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	// Update sensor fields
	sensor.Types = request.Types
	sensor.Latitude = request.Latitude
	sensor.Longitude = request.Longitude
	
	// Validate updated sensor data
	if err := sensor.Validate(); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid sensor data",
			"errors": map[string]interface{}{
				"types": []string{err.Error()},
			},
			"supported_types": models.GetSupportedTypes(),
		})
	}
	
	if err := facades.Orm().Query().Save(&sensor); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to update sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"message": "Sensor updated successfully",
		"data":    sensor,
	})
}

// AddType adds a new type to an existing sensor
func (r *SensorController) AddType(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	sensorType := ctx.Request().Input("type", "")
	
	if sensorType == "" {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Type parameter is required",
		})
	}
	
	var sensor models.Sensor
	if err := facades.Orm().Query().Find(&sensor, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	if err := sensor.AddType(sensorType); err != nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": err.Error(),
			"supported_types": models.GetSupportedTypes(),
		})
	}
	
	if err := facades.Orm().Query().Save(&sensor); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to update sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"message": "Sensor type added successfully",
		"data":    sensor,
	})
}

// RemoveType removes a type from an existing sensor
func (r *SensorController) RemoveType(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	sensorType := ctx.Request().Input("type", "")
	
	if sensorType == "" {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Type parameter is required",
		})
	}
	
	var sensor models.Sensor
	if err := facades.Orm().Query().Find(&sensor, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	// Make sure the sensor will have at least one type after removal
	if len(sensor.Types) <= 1 && sensor.HasType(sensorType) {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Cannot remove the only type from a sensor",
		})
	}
	
	sensor.RemoveType(sensorType)
	
	if err := facades.Orm().Query().Save(&sensor); err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to update sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"message": "Sensor type removed successfully",
		"data":    sensor,
	})
}

// Destroy soft-deletes a sensor
func (r *SensorController) Destroy(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	
	var sensor models.Sensor
	if err := facades.Orm().Query().Find(&sensor, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	// Fix: Properly handle both return values from Delete
	_, err := facades.Orm().Query().Delete(&sensor)
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to delete sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"message": "Sensor deleted successfully",
	})
}

// Restore recovers a soft-deleted sensor
func (r *SensorController) Restore(ctx http.Context) http.Response {
	id := ctx.Request().Route("id")
	
	var sensor models.Sensor
	if err := facades.Orm().Query().WithTrashed().Find(&sensor, id); err != nil {
		return ctx.Response().Json(http.StatusNotFound, map[string]interface{}{
			"message": "Sensor not found",
		})
	}
	
	if sensor.DeletedAt == nil {
		return ctx.Response().Json(http.StatusBadRequest, map[string]interface{}{
			"message": "Sensor is not deleted",
		})
	}
	
	_,err := facades.Orm().Query().Model(&sensor).Update("deleted_at", nil); 
	if err != nil {
		return ctx.Response().Json(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to restore sensor",
			"error":   err.Error(),
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"message": "Sensor restored successfully",
		"data":    sensor,
	})
}

// GetSensorTypes returns all supported sensor types
func (r *SensorController) GetSensorTypes(ctx http.Context) http.Response {
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"types": models.GetSupportedTypes(),
	})
}

// SensorHistoryRequest defines the request structure for history retrieval
type SensorHistoryRequest struct {
	SensorID  string    `form:"sensor_id" binding:"required"`
	StartTime time.Time `form:"start_time"`
	EndTime   time.Time `form:"end_time"`
}

// SensorRecordData defines the response structure for a sensor record
type SensorRecordData struct {
	ID        uint      `json:"id"`
	IDSensor  string    `json:"id_sensor"`
	RawData   string    `json:"raw_data"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// GetHistorySensorStream streams the history of sensor data
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

// GetStatistics returns statistical data about sensors
func (r *SensorController) GetStatistics(ctx http.Context) http.Response {
	// Count total sensors
	var totalSensors int64
	facades.Orm().Query().Model(&models.Sensor{}).Count(&totalSensors)
	
	// Count active sensors (those that have records in the last 24 hours)
	var activeSensors int64
	facades.Orm().Query().Raw(`
		SELECT COUNT(DISTINCT s.id) 
		FROM sensors s
		JOIN sensor_records sr ON s.id = sr.id_sensor
		WHERE sr.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
		AND s.deleted_at IS NULL
	`).Scan(&activeSensors)
	
	// Get type statistics
	var sensors []models.Sensor
	facades.Orm().Query().Find(&sensors)
	
	// Count occurrences of each type
	typeCounts := make(map[string]int)
	for _, sensor := range sensors {
		for _, sensorType := range sensor.Types {
			typeCounts[sensorType]++
		}
	}
	
	// Convert to expected format
	typeStats := make([]map[string]interface{}, 0, len(typeCounts))
	for typeName, count := range typeCounts {
		typeStats = append(typeStats, map[string]interface{}{
			"type":  typeName,
			"count": count,
		})
	}
	
	return ctx.Response().Json(http.StatusOK, map[string]interface{}{
		"total_sensors":    totalSensors,
		"active_sensors":   activeSensors,
		"sensors_by_type":  typeStats,
		"supported_types":  models.GetSupportedTypes(),
		"generated_at":     time.Now(),
	})
}