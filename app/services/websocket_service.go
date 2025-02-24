package services

import (
	"context"
	"encoding/json"
	"fmt"
	"goravel/app/models"
	// "math"
	"net/http"
	// "strconv"
	// "strings"
	"sync"
	"time"

	contractshttp "github.com/goravel/framework/contracts/http"
	"github.com/goravel/framework/facades"
	"github.com/gorilla/websocket"
)

type WebSocketService struct {
	ctx        context.Context
	cancel     context.CancelFunc
	clients    map[*websocket.Conn]bool
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mutex      sync.RWMutex

	*TCPVesselService
	*TCPSensorService

	kapalCache      map[string]*models.Kapal
	sensorCache     map[string]*models.Sensor
	kapalCacheTime  time.Time
	sensorCacheTime time.Time
	cacheMutex      sync.RWMutex
}

func getStatusString(isActive bool) string {
	if isActive {
		return "Connected"
	}
	return "Disconnected"
}

type VesselData struct {
	CallSign                    string  `json:"call_sign"`
	Flag                        string  `json:"flag"`
	Kelas                       string  `json:"kelas"`
	Builder                     string  `json:"builder"`
	YearBuilt                   uint    `json:"year_built"`
	HeadingDirection            int64   `json:"heading_direction"`
	Calibration                 int64   `json:"calibration"`
	WidthM                      int64   `json:"width_m"`
	LengthM                      int64   `json:"length_m"`
	BowToStern                  int64   `json:"bow_to_stern"`
	PortToStarboard             int64   `json:"port_to_starboard"`
	VesselMapImage              string  `json:"vessel_map_image"`
	Image                       string  `json:"image"`
	HistoryPerSecond            int64   `json:"history_per_second"`
	MinimumKnotPerLiterGasoline float64 `json:"minimum_knot_per_liter_gasoline"`
	MaximumKnotPerLiterGasoline float64 `json:"maximum_knot_per_liter_gasoline"`
	RecordStatus                bool    `json:"record_status"`
}

type TelemetryData struct {
	CallSign                    string    `json:"call_sign"`
	Latitude                    string    `json:"latitude"`
	Longitude                   string    `json:"longitude"`
	LatitudeDMS                 string    `json:"latitude_dms"`
	LongitudeDMS                string    `json:"longitude_dms"`
	LatitudeDecimal             float64   `json:"latitude_decimal"`
	LongitudeDecimal            float64   `json:"longitude_decimal"`
	HeadingDegree               float64   `json:"heading_degree"`
	SpeedInKnots                float64   `json:"speed_in_knots"`
	SpeedInKmh                  float64   `json:"speed_in_kmh"`
	GpsQualityIndicator         string    `json:"gps_quality_indicator"`
	WaterDepth                  float64   `json:"water_depth"`
	TelnetStatus                string    `json:"telnet_status"`
	LastUpdate                  time.Time `json:"last_update"`
	CurrentKnotPerLiterGasoline float64   `json:"current_knot_per_liter_gasoline"`
	FuelEfficiencyStatus        string    `json:"fuel_efficiency_status"`
}

type NavigationData struct {
	CallSign  string        `json:"call_sign"`
	Vessel    VesselData    `json:"vessel"`
	Telemetry TelemetryData `json:"telemetry"`
}

type SensorData struct {
	ID               string     `json:"id"`
	Types            []string   `json:"types"`
	Latitude         string     `json:"latitude"`
	Longitude        string     `json:"longitude"`
	RawData          *string    `json:"raw_data"`    // Nullable
	LastUpdate       *time.Time `json:"last_update"` // Nullable
	ConnectionStatus string     `json:"connection_status"`
}

type WebSocketResponse struct {
	Navigation map[string]NavigationData `json:"navigation"`
	Sensors    map[string]SensorData     `json:"sensors"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewWebSocketService(tcpService *TCPVesselService, sensorService *TCPSensorService) *WebSocketService {
	ctx, cancel := context.WithCancel(context.Background())
	ws := &WebSocketService{
		ctx:              ctx,
		cancel:           cancel,
		clients:          make(map[*websocket.Conn]bool),
		register:         make(chan *websocket.Conn),
		unregister:       make(chan *websocket.Conn),
		TCPVesselService: tcpService,
		TCPSensorService: sensorService,
		kapalCache:       make(map[string]*models.Kapal),
		sensorCache:      make(map[string]*models.Sensor),
	}

	go ws.run()
	go ws.updateCache() // Initial cache update
	go ws.broadcastData()

	return ws
}

func (ws *WebSocketService) updateCache() {
	ws.cacheMutex.Lock()
	defer ws.cacheMutex.Unlock()

	// Update kapal cache
	var vessels []models.Kapal
	if err := facades.Orm().Query().Find(&vessels); err == nil {
		newKapalCache := make(map[string]*models.Kapal)
		for i := range vessels {
			newKapalCache[vessels[i].CallSign] = &vessels[i]
		}
		ws.kapalCache = newKapalCache
	}

	// Update sensor cache
	var sensors []models.Sensor
	if err := facades.Orm().Query().Find(&sensors); err == nil {
		newSensorCache := make(map[string]*models.Sensor)
		for i := range sensors {
			newSensorCache[sensors[i].ID] = &sensors[i]
		}
		ws.sensorCache = newSensorCache
	}

	ws.kapalCacheTime = time.Now()
	ws.sensorCacheTime = time.Now()
}

func (ws *WebSocketService) run() {
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

func (ws *WebSocketService) HandleConnection(c contractshttp.Context) error {
	responseWriter := c.Response().Writer()
	request := c.Request().Origin()

	conn, err := upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("WebSocket upgrade failed: %v", err))
		return err
	}

	ws.register <- conn

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			ws.unregister <- conn
			break
		}
	}

	return nil
}
func (ws *WebSocketService) broadcastData() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if time.Since(ws.kapalCacheTime) > time.Minute {
				ws.updateCache()
			}

			response := WebSocketResponse{
				Navigation: ws.getNavigationData(),
				Sensors:    ws.getSensorData(),
			}

			// Broadcast even if one of them has data
			// if len(response.Navigation) > 0 || len(response.Sensors) > 0 {
			jsonData, err := json.Marshal(response)
			if err != nil {
				facades.Log().Error("JSON marshal error:", err)
				continue
			}
			ws.broadcastToClients(jsonData)
			// }

		case <-ws.ctx.Done():
			return
		}
	}
}

func (ws *WebSocketService) getNavigationData() map[string]NavigationData {
	// Check and update cache if needed
	if time.Since(ws.kapalCacheTime) > time.Minute {
		ws.updateCache()
	}

	navigationData := make(map[string]NavigationData)

	ws.TCPVesselService.bufferMutex.Lock()
	defer ws.TCPVesselService.bufferMutex.Unlock()

	ws.cacheMutex.RLock()
	defer ws.cacheMutex.RUnlock()

	// Process vessels with buffers first
	for callSign, buffer := range ws.TCPVesselService.nmeaBuffers {
		vessel, exists := ws.kapalCache[callSign]
		if !exists {
			continue
		}

		buffer.mutex.Lock()
		_, isActive := ws.TCPVesselService.activeVessels[callSign]

		latDec, latDMS := models.ParseCoordinate(buffer.Latitude)
		lonDec, lonDMS := models.ParseCoordinate(buffer.Longitude)

		navigationData[callSign] = NavigationData{
			CallSign: callSign,
			Vessel:   createVesselData(vessel),
			Telemetry: createTelemetryData(buffer, vessel, callSign, isActive,
				latDec, latDMS, lonDec, lonDMS),
		}
		buffer.mutex.Unlock()
	}

	// Add vessels without active buffers
	for callSign, vessel := range ws.kapalCache {
		if _, hasBuffer := navigationData[callSign]; !hasBuffer {
			if lastRecord := getLastRecord(callSign); lastRecord != nil {
				_, isActive := ws.TCPVesselService.activeVessels[callSign]
				latDec, latDMS := models.ParseCoordinate(lastRecord.Latitude)
				lonDec, lonDMS := models.ParseCoordinate(lastRecord.Longitude)

				navigationData[callSign] = NavigationData{
					CallSign: callSign,
					Vessel:   createVesselData(vessel),
					Telemetry: createTelemetryDataFromRecord(lastRecord, vessel, isActive,
						latDec, latDMS, lonDec, lonDMS),
				}
			}
		}
	}

	return navigationData
}

func (ws *WebSocketService) getSensorData() map[string]SensorData {
	ws.TCPSensorService.bufferMutex.Lock()
	defer ws.TCPSensorService.bufferMutex.Unlock()

	ws.cacheMutex.RLock()
	defer ws.cacheMutex.RUnlock()

	sensorData := make(map[string]SensorData)

	// Process all sensors in cache
	for sensorID, sensor := range ws.sensorCache {
		var rawData string
		var lastUpdate time.Time

		// Try to get from buffer first
		if buffer, exists := ws.TCPSensorService.sensorBuffers[sensorID]; exists {
			buffer.mutex.Lock()
			rawData = buffer.RawData
			lastUpdate = buffer.LastUpdateTime
			buffer.mutex.Unlock()
		} else {
			// If no buffer, get latest record
			var record models.SensorRecord
			err := facades.Orm().Query().
				Where("id_sensor = ?", sensorID).
				Order("created_at DESC").
				First(&record)

			if err == nil {
				rawData = record.RawData
				lastUpdate = record.CreatedAt
			} else {
				continue // Skip if no data available
			}
		}

		key := fmt.Sprintf("%s", sensor.ID)
		sensorData[key] = SensorData{
			ID:               sensor.ID,
			Types:            sensor.Types,
			Latitude:         sensor.Latitude,
			Longitude:        sensor.Longitude,
			RawData:          &rawData,
			LastUpdate:       &lastUpdate,
			ConnectionStatus: getStatusString(ws.TCPSensorService.ConnectionStatus),
		}
	}

	return sensorData
}

func (ws *WebSocketService) getConnectionStatus(callSign string) string {
	ws.TCPVesselService.bufferMutex.Lock()
	defer ws.TCPVesselService.bufferMutex.Unlock()

	_, exists := ws.TCPVesselService.activeVessels[callSign]
	if exists {
		return "Connected"
	}
	return "Disconnected"
}

func (ws *WebSocketService) broadcastToClients(data []byte) {
	ws.mutex.RLock()
	defer ws.mutex.RUnlock()

	for client := range ws.clients {
		err := client.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			ws.unregister <- client
			facades.Log().Error(fmt.Sprintf("WebSocket write error: %v", err))
		}
	}
}

func createVesselData(vessel *models.Kapal) VesselData {
	return VesselData{
		CallSign:                    vessel.CallSign,
		Flag:                        vessel.Flag,
		Kelas:                       vessel.Kelas,
		Builder:                     vessel.Builder,
		YearBuilt:                   vessel.YearBuilt,
		HeadingDirection:            vessel.HeadingDirection,
		Calibration:                 vessel.Calibration,
		WidthM:                      vessel.WidthM,
		LengthM:                      vessel.LengthM,
		BowToStern:                  vessel.BowToStern,
		PortToStarboard:             vessel.PortToStarboard,
		VesselMapImage:              vessel.ImageMap,
		Image:                       vessel.Image,
		HistoryPerSecond:            vessel.HistoryPerSecond,
		MinimumKnotPerLiterGasoline: vessel.MinimumKnotPerLiterGasoline,
		MaximumKnotPerLiterGasoline: vessel.MaximumKnotPerLiterGasoline,
		RecordStatus:                vessel.RecordStatus,
	}
}

func createTelemetryData(buffer *NMEABuffer, vessel *models.Kapal, callSign string, isActive bool,
	latDec float64, latDMS string, lonDec float64, lonDMS string) TelemetryData {

	return TelemetryData{
		CallSign:            callSign,
		Latitude:            buffer.Latitude,
		Longitude:           buffer.Longitude,
		LatitudeDMS:         latDMS,
		LongitudeDMS:        lonDMS,
		LatitudeDecimal:     latDec,
		LongitudeDecimal:    lonDec,
		HeadingDegree:       buffer.HeadingDegree,
		SpeedInKnots:        buffer.SpeedInKnots,
		SpeedInKmh:          buffer.SpeedInKnots * 1.852,
		GpsQualityIndicator: string(buffer.GpsQualityIndicator),
		WaterDepth:          buffer.WaterDepth,
		TelnetStatus:        getStatus(isActive),
		LastUpdate:          buffer.LastGGATime,
		CurrentKnotPerLiterGasoline: models.CalculateFuelEfficiency(
			buffer.SpeedInKnots,
			vessel.MinimumKnotPerLiterGasoline,
			vessel.MaximumKnotPerLiterGasoline,
		),
		FuelEfficiencyStatus: models.GetFuelEfficiencyStatus(
			models.CalculateFuelEfficiency(
				buffer.SpeedInKnots,
				vessel.MinimumKnotPerLiterGasoline,
				vessel.MaximumKnotPerLiterGasoline,
			),
			vessel.MinimumKnotPerLiterGasoline,
			vessel.MaximumKnotPerLiterGasoline,
		),
	}
}

func createTelemetryDataFromRecord(record *models.VesselRecord, vessel *models.Kapal, isActive bool,
	latDec float64, latDMS string, lonDec float64, lonDMS string) TelemetryData {

	return TelemetryData{
		CallSign:            record.CallSign,
		Latitude:            record.Latitude,
		Longitude:           record.Longitude,
		LatitudeDMS:         latDMS,
		LongitudeDMS:        lonDMS,
		LatitudeDecimal:     latDec,
		LongitudeDecimal:    lonDec,
		HeadingDegree:       record.HeadingDegree,
		SpeedInKnots:        record.SpeedInKnots,
		SpeedInKmh:          record.SpeedInKnots * 1.852,
		GpsQualityIndicator: string(record.GpsQualityIndicator),
		WaterDepth:          record.WaterDepth,
		TelnetStatus:        getStatus(isActive),
		LastUpdate:          record.CreatedAt,
		CurrentKnotPerLiterGasoline: models.CalculateFuelEfficiency(
			record.SpeedInKnots,
			vessel.MinimumKnotPerLiterGasoline,
			vessel.MaximumKnotPerLiterGasoline,
		),
		FuelEfficiencyStatus: models.GetFuelEfficiencyStatus(
			models.CalculateFuelEfficiency(
				record.SpeedInKnots,
				vessel.MinimumKnotPerLiterGasoline,
				vessel.MaximumKnotPerLiterGasoline,
			),
			vessel.MinimumKnotPerLiterGasoline,
			vessel.MaximumKnotPerLiterGasoline,
		),
	}
}

func getLastRecord(callSign string) *models.VesselRecord {
	var lastRecord models.VesselRecord
	err := facades.Orm().Query().
		Where("call_sign = ?", callSign).
		Order("created_at DESC").
		First(&lastRecord)
	if err != nil {
		return nil
	}
	return &lastRecord
}

func getStatus(isActive bool) string {
	if isActive {
		return "Connected"
	}
	return "Disconnected"
}
