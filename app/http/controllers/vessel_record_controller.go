package controllers

import (
	"encoding/json"
	"goravel/app/helpers/response"
	"goravel/app/models"
	"net/http"
	"time"

	contractshttp "github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
)

type VesselRecordController struct {
	// Dependent services
}

type VesselRecordData struct {
	VesselData VesselData    `json:"vessel_data"`
	Records    []RecordData  `json:"record"`
 }

type HistoryRequest struct {
    CallSign  string    `form:"call_sign" binding:"required"`
    StartTime time.Time `form:"start_time" binding:"required"`  // UTC time
    EndTime   time.Time `form:"end_time" binding:"required"`    // UTC time
}


type VesselHistoryData struct {
    Vessel  VesselData     `json:"vessel"`
    Records []RecordData   `json:"records"`
}

type VesselData struct {
    CallSign                    string    `json:"call_sign"`
    Flag                        string    `json:"flag"`
    Kelas                       string    `json:"kelas"`
    Builder                     string    `json:"builder"`
    YearBuilt                   uint      `json:"year_built"`
    HeadingDirection            int64     `json:"heading_direction"`
    Calibration                 int64     `json:"calibration"`
    WidthM                      int64     `json:"width_m"`
    Height                      int64     `json:"height_m"`
    TopRange                    int64     `json:"top_range"`
    LeftRange                   int64     `json:"left_range"`
    ImageMap                    string    `json:"image_map"`
    Image                       string    `json:"image"`
    HistoryPerSecond           int64     `json:"history_per_second"`
    MinimumKnotPerLiterGasoline float64   `json:"minimum_knot_per_liter_gasoline"`
    MaximumKnotPerLiterGasoline float64   `json:"maximum_knot_per_liter_gasoline"`
    RecordStatus               bool      `json:"record_status"`
}

type RecordData struct {
    Timestamp      time.Time `json:"timestamp"`
    CallSign       string    `json:"call_sign"`
    Latitude       string    `json:"latitude"`
    Longitude      string    `json:"longitude"`
    HeadingDegree  float64   `json:"heading_degree"`
    SpeedInKnots   float64   `json:"speed_in_knots"`
    WaterDepth     float64   `json:"water_depth"`
    TelnetStatus   string    `json:"telnet_status"`
    SeriesID       int64     `json:"series_id"`
}

func NewVesselRecordController() *VesselRecordController {
	return &VesselRecordController{
		// Inject services
	}
}
func (c *VesselRecordController) StreamHistory(ctx contractshttp.Context) contractshttp.Response {
    var request HistoryRequest
    
    if err := ctx.Request().Bind(&request); err != nil {
        return ctx.Response().Json(400, response.Error(400, "Invalid request parameters", err.Error()))
    }

    // Validate time range
    // if request.EndTime.Sub(request.StartTime) > 24*time.Hour {
    //     return ctx.Response().Json(400, response.Error(400, "Time range cannot exceed 24 hours", ""))
    // }

    // Set response headers for streaming 
    writer := ctx.Response().Writer()
    writer.Header().Set("Content-Type", "application/x-ndjson")
    writer.Header().Set("Transfer-Encoding", "chunked")
    writer.WriteHeader(200)

    var lastID uint64 = 0
    const batchSize = 100 // Smaller batch size for faster streaming

    for {
        var records []models.VesselRecord
        err := facades.Orm().Query().Model(&models.VesselRecord{}).
            Where("call_sign = ?", request.CallSign).
            Where("created_at BETWEEN ? AND ?", request.StartTime, request.EndTime).
            Where("id > ?", lastID).
            Order("id ASC").
            Limit(batchSize).
            Find(&records)

        if err != nil {
            return ctx.Response().Json(500, response.Error(500, "Database query failed", err.Error()))
        }

        if len(records) == 0 {
            break
        }

        recordBatch := make([]byte, 0, len(records)*256)
        for _, record := range records {
            if record.ID > lastID {
                lastID = record.ID
            }

            recordData := RecordData{
                Timestamp:     record.CreatedAt,
                CallSign:      record.CallSign,
                Latitude:      record.Latitude,
                Longitude:     record.Longitude,
                HeadingDegree: record.HeadingDegree,
                SpeedInKnots:  record.SpeedInKnots,
                WaterDepth:    record.WaterDepth,
                TelnetStatus:  string(record.TelnetStatus),
                SeriesID:      int64(record.SeriesID),
            }

            jsonData, err := json.Marshal(recordData)
            if err != nil {
                continue
            }

            recordBatch = append(recordBatch, jsonData...)
            recordBatch = append(recordBatch, ',')
        }

        if len(recordBatch) > 0 {
            writer.Write(recordBatch)
            writer.(http.Flusher).Flush()
        }

        if len(records) < batchSize {
            break
        }
    }

    return nil
}