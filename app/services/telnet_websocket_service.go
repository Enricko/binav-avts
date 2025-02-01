// app/services/websocket_service.go

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"goravel/app/models"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	contractshttp "github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
	"github.com/gorilla/websocket"
)

type TelnetWebSocketService struct {
	ctx           context.Context
	cancel        context.CancelFunc
	clients       map[*websocket.Conn]bool
	register      chan *websocket.Conn
	unregister    chan *websocket.Conn
	mutex         sync.RWMutex
	telnetService *TelnetService
}

// VesselData represents static vessel information from Kapal model
type VesselData struct {
	// Basic Info
	CallSign  string `json:"call_sign"`
	Flag      string `json:"flag"`
	Kelas     string `json:"kelas"`
	Builder   string `json:"builder"`
	YearBuilt uint   `json:"year_built"`

	// Dimensions and Calibration
	HeadingDirection int64 `json:"heading_direction"`
	Calibration      int64 `json:"calibration"`
	WidthM           int64 `json:"width_m"`
	Height           int64 `json:"height_m"`
	TopRange         int64 `json:"top_range"`
	LeftRange        int64 `json:"left_range"`

	// Images
	ImageMap string `json:"image_map"`
	Image    string `json:"image"`

	// Performance Settings
	HistoryPerSecond            int64   `json:"history_per_second"`
	MinimumKnotPerLiterGasoline float64 `json:"minimum_knot_per_liter_gasoline"`
	MaximumKnotPerLiterGasoline float64 `json:"maximum_knot_per_liter_gasoline"`
	RecordStatus                bool    `json:"record_status"`
}

// TelemetryData represents real-time NMEA and telnet data
type TelemetryData struct {
	// Basic Reference
	CallSign string `json:"call_sign"`

	// Position
	Latitude         string  `json:"latitude"`
	Longitude        string  `json:"longitude"`
	LatitudeDMS      string  `json:"latitude_dms"`
	LongitudeDMS     string  `json:"longitude_dms"`
	LatitudeDecimal  float64 `json:"latitude_decimal"`
	LongitudeDecimal float64 `json:"longitude_decimal"`

	// Navigation
	HeadingDegree float64 `json:"heading_degree"`
	SpeedInKnots  float64 `json:"speed_in_knots"`
	SpeedInKmh    float64 `json:"speed_in_kmh"`

	// Sensors
	GpsQualityIndicator string  `json:"gps_quality_indicator"`
	WaterDepth          float64 `json:"water_depth"`

	// Status
	TelnetStatus string    `json:"telnet_status"`
	LastUpdate   time.Time `json:"last_update"`

	// Calculated Fields
	CurrentKnotPerLiterGasoline float64 `json:"current_knot_per_liter_gasoline"`
	FuelEfficiencyStatus        string  `json:"fuel_efficiency_status"`
}

type WebSocketResponse struct {
	Vessel    VesselData    `json:"vessel"`
	Telemetry TelemetryData `json:"telemetry"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Adjust this for production
	},
}

func NewTelnetWebSocketService(telnetService *TelnetService) *TelnetWebSocketService {
	ctx, cancel := context.WithCancel(context.Background())
	ws := &TelnetWebSocketService{
		ctx:           ctx,
		cancel:        cancel,
		clients:       make(map[*websocket.Conn]bool),
		register:      make(chan *websocket.Conn),
		unregister:    make(chan *websocket.Conn),
		telnetService: telnetService,
	}

	go ws.run()
	go ws.broadcastVesselData()

	return ws
}

func (ws *TelnetWebSocketService) HandleConnection(c contractshttp.Context) error {
	// Get the underlying http.ResponseWriter and *http.Request
	responseWriter := c.Response().Writer()
	request := c.Request().Origin()

	// Upgrade the connection
	conn, err := upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("WebSocket upgrade failed: %v", err))
		return err
	}

	ws.register <- conn

	// Keep reading to detect disconnection
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			ws.unregister <- conn
			break
		}
	}

	return nil
}

func (ws *TelnetWebSocketService) run() {
	for {
		select {
		case client := <-ws.register:
			ws.mutex.Lock()
			ws.clients[client] = true
			ws.mutex.Unlock()
			facades.Log().Debug("New WebSocket client connected")

		case client := <-ws.unregister:
			ws.mutex.Lock()
			if _, ok := ws.clients[client]; ok {
				delete(ws.clients, client)
				client.Close()
			}
			ws.mutex.Unlock()
			facades.Log().Debug("WebSocket client disconnected")

		case <-ws.ctx.Done():
			ws.mutex.Lock()
			for client := range ws.clients {
				client.Close()
				delete(ws.clients, client)
			}
			ws.mutex.Unlock()
			return
		}
	}
}
func (ws *TelnetWebSocketService) broadcastVesselData() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			data := make(map[string]WebSocketResponse)
			bufferMutex := ws.telnetService.GetBufferMutex()
			buffers := ws.telnetService.GetNMEABuffers()

			bufferMutex.RLock()
			activeCallSigns := make(map[string]bool)

			// Process active telnet connections
			for callSign, buffer := range buffers {
				buffer.mutex.Lock()

				var kapal models.Kapal
				err := facades.Orm().Query().
					Where("call_sign = ?", callSign).
					First(&kapal)

				if err != nil {
					facades.Log().Error(fmt.Sprintf("Failed to fetch kapal data for %s: %v", callSign, err))
					buffer.mutex.Unlock()
					continue
				}

				latDec, latDMS := parseCoordinate(buffer.Latitude)
				lonDec, lonDMS := parseCoordinate(buffer.Longitude)

				currentKnotPerLiter := calculateFuelEfficiency(buffer.SpeedInKnots, kapal.MinimumKnotPerLiterGasoline, kapal.MaximumKnotPerLiterGasoline)
				efficiencyStatus := getFuelEfficiencyStatus(
					currentKnotPerLiter,
					kapal.MinimumKnotPerLiterGasoline,
					kapal.MaximumKnotPerLiterGasoline,
				)

				data[callSign] = WebSocketResponse{
					Vessel: VesselData{
						CallSign:                    callSign,
						Flag:                        kapal.Flag,
						Kelas:                       kapal.Kelas,
						Builder:                     kapal.Builder,
						YearBuilt:                   kapal.YearBuilt,
						HeadingDirection:            kapal.HeadingDirection,
						Calibration:                 kapal.Calibration,
						WidthM:                      kapal.WidthM,
						Height:                      kapal.Height,
						TopRange:                    kapal.TopRange,
						LeftRange:                   kapal.LeftRange,
						ImageMap:                    kapal.ImageMap,
						Image:                       kapal.Image,
						HistoryPerSecond:            kapal.HistoryPerSecond,
						MinimumKnotPerLiterGasoline: kapal.MinimumKnotPerLiterGasoline,
						MaximumKnotPerLiterGasoline: kapal.MaximumKnotPerLiterGasoline,
						RecordStatus:                kapal.RecordStatus,
					},
					Telemetry: TelemetryData{
						CallSign:                    callSign,
						Latitude:                    buffer.Latitude,
						Longitude:                   buffer.Longitude,
						LatitudeDMS:                 latDMS,
						LongitudeDMS:                lonDMS,
						LatitudeDecimal:             latDec,
						LongitudeDecimal:            lonDec,
						HeadingDegree:               buffer.HeadingDegree,
						SpeedInKnots:                buffer.SpeedInKnots,
						SpeedInKmh:                  buffer.SpeedInKnots * 1.852,
						GpsQualityIndicator:         string(buffer.GpsQualityIndicator),
						WaterDepth:                  buffer.WaterDepth,
						TelnetStatus:                "Connected",
						LastUpdate:                  buffer.LastGGATime,
						CurrentKnotPerLiterGasoline: currentKnotPerLiter,
						FuelEfficiencyStatus:        efficiencyStatus,
					},
				}
				activeCallSigns[callSign] = true
				buffer.mutex.Unlock()
			}
			bufferMutex.RUnlock()

			// Get all unique call signs from vessel_records
			var allCallSigns []string
			err := facades.Orm().Query().
				Table("vessel_records").
				Select("DISTINCT call_sign").
				Where("call_sign IS NOT NULL").
				Pluck("call_sign", &allCallSigns)

			if err != nil {
				facades.Log().Error(fmt.Sprintf("Failed to fetch call signs: %v", err))
				continue
			}

			// For each call sign not in active buffers, get latest record
			for _, callSign := range allCallSigns {
				if !activeCallSigns[callSign] {
					var latestRecord models.VesselRecord
					err := facades.Orm().Query().
						Where("call_sign = ?", callSign).
						Order("created_at DESC").
						First(&latestRecord)

					if err != nil {
						facades.Log().Error(fmt.Sprintf("Failed to fetch latest record for %s: %v", callSign, err))
						continue
					}

					// Get vessel details
					var kapal models.Kapal
					err = facades.Orm().Query().
						Where("call_sign = ?", callSign).
						First(&kapal)

					if err != nil {
						facades.Log().Error(fmt.Sprintf("Failed to fetch kapal data for %s: %v", callSign, err))
						continue
					}

					latDec, latDMS := parseCoordinate(latestRecord.Latitude)
					lonDec, lonDMS := parseCoordinate(latestRecord.Longitude)

					currentKnotPerLiter := calculateFuelEfficiency(latestRecord.SpeedInKnots, kapal.MinimumKnotPerLiterGasoline, kapal.MaximumKnotPerLiterGasoline)
					efficiencyStatus := getFuelEfficiencyStatus(
						currentKnotPerLiter,
						kapal.MinimumKnotPerLiterGasoline,
						kapal.MaximumKnotPerLiterGasoline,
					)

					data[callSign] = WebSocketResponse{
						Vessel: VesselData{
							CallSign:                    callSign,
							Flag:                        kapal.Flag,
							Kelas:                       kapal.Kelas,
							Builder:                     kapal.Builder,
							YearBuilt:                   kapal.YearBuilt,
							HeadingDirection:            kapal.HeadingDirection,
							Calibration:                 kapal.Calibration,
							WidthM:                      kapal.WidthM,
							Height:                      kapal.Height,
							TopRange:                    kapal.TopRange,
							LeftRange:                   kapal.LeftRange,
							ImageMap:                    kapal.ImageMap,
							Image:                       kapal.Image,
							HistoryPerSecond:            kapal.HistoryPerSecond,
							MinimumKnotPerLiterGasoline: kapal.MinimumKnotPerLiterGasoline,
							MaximumKnotPerLiterGasoline: kapal.MaximumKnotPerLiterGasoline,
							RecordStatus:                kapal.RecordStatus,
						},
						Telemetry: TelemetryData{
							CallSign:                    callSign,
							Latitude:                    latestRecord.Latitude,
							Longitude:                   latestRecord.Longitude,
							LatitudeDMS:                 latDMS,
							LongitudeDMS:                lonDMS,
							LatitudeDecimal:             latDec,
							LongitudeDecimal:            lonDec,
							HeadingDegree:               latestRecord.HeadingDegree,
							SpeedInKnots:                latestRecord.SpeedInKnots,
							SpeedInKmh:                  latestRecord.SpeedInKnots * 1.852,
							GpsQualityIndicator:         string(latestRecord.GpsQualityIndicator),
							WaterDepth:                  latestRecord.WaterDepth,
							TelnetStatus:                string(latestRecord.TelnetStatus),
							LastUpdate:                  latestRecord.CreatedAt,
							CurrentKnotPerLiterGasoline: currentKnotPerLiter,
							FuelEfficiencyStatus:        efficiencyStatus,
						},
					}
				}
			}

			if len(data) > 0 {
				jsonData, err := json.Marshal(data)
				if err != nil {
					facades.Log().Error(fmt.Sprintf("JSON marshal error: %v", err))
					continue
				}

				ws.mutex.RLock()
				for client := range ws.clients {
					err := client.WriteMessage(websocket.TextMessage, jsonData)
					if err != nil {
						ws.unregister <- client
						facades.Log().Error(fmt.Sprintf("WebSocket write error: %v", err))
					}
				}
				ws.mutex.RUnlock()
			}

		case <-ws.ctx.Done():
			return
		}
	}
}

// Helper function to calculate fuel efficiency
func calculateFuelEfficiency(speedInKnots float64, min float64, max float64) float64 {
	// No movement means no efficiency
	if speedInKnots <= 0 {
		return 0
	}

	// Simple linear average based on speed
	efficiency := (speedInKnots + min + max) / 3

	return math.Round(efficiency*100) / 100 // Round to 2 decimal places
}

// Helper function to determine fuel efficiency status
// getFuelEfficiencyStatus determines efficiency status based on min/max ranges
func getFuelEfficiencyStatus(current, min, max float64) string {
	// Handle no movement case
	if current <= 0 {
		return "Stopped"
	}

	// Calculate midpoint between min and max for "Normal" range
	midpoint := (min + max) / 2

	// Determine status based on current value
	if current >= max {
		return "Efficient"
	} else if current >= midpoint {
		return "Normal"
	} else if current >= min {
		return "Below Normal"
	}

	return "Inefficient"
}

// Helper function to parse coordinates
func parseCoordinate(coord string) (float64, string) {
	parts := strings.Split(strings.ReplaceAll(coord, "°", " "), " ")
	if len(parts) < 3 {
		return 0, ""
	}

	degrees, _ := strconv.ParseFloat(parts[0], 64)
	minutes, _ := strconv.ParseFloat(parts[1], 64)
	direction := parts[2]

	decimal := degrees + minutes/60
	if direction == "S" || direction == "W" {
		decimal = -decimal
	}

	dms := fmt.Sprintf("%d°%g'%s", int(degrees), minutes, direction)

	return decimal, dms
}

func (ws *TelnetWebSocketService) Stop() {
	ws.cancel()
}
