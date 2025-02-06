package services

import (
	"fmt"
	"goravel/app/models"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/goravel/framework/facades"
)

type TCPVesselService struct {
	listener net.Listener
	mutex    sync.Mutex
	cache    map[string]*CacheEntry

	// Vessel Process Service
	bufferMutex   sync.Mutex
	nmeaBuffers   map[string]*NMEABuffer   // key is CallSign
	activeVessels map[string]*models.Kapal // Track active vessels in memory
}

type CacheEntry struct {
	kapal     *models.Kapal
	error     error
	timestamp time.Time
}

type NMEABuffer struct {
	Latitude            string
	Longitude           string
	HeadingDegree       float64
	SpeedInKnots        float64
	GpsQualityIndicator models.GpsQuality
	WaterDepth          float64
	LastGGATime         time.Time
	LastRecordTime      time.Time
	LastVTGTime         time.Time // Track when we last got VTG data
	LastHDTTime         time.Time // Track when we last got HDT data
	mutex               sync.Mutex
}

const (
	cacheDuration     = 1 * time.Minute
	disconnectTimeout = 10 * time.Second // Lower timeout for quicker disconnect detection
	checkInterval     = 5 * time.Second  // Check every 5 seconds
)

func NewTCPVesselService() *TCPVesselService {
	return &TCPVesselService{
		cache:         make(map[string]*CacheEntry),
		nmeaBuffers:   make(map[string]*NMEABuffer),
		activeVessels: make(map[string]*models.Kapal),
	}
}

func (s *TCPVesselService) trackVessel(kapal *models.Kapal) {
	s.bufferMutex.Lock()
	defer s.bufferMutex.Unlock()

	s.activeVessels[kapal.CallSign] = kapal
}

func (s *TCPVesselService) Start() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Mark all vessels as disconnected when service starts
	s.markAllVesselsDisconnected()

	if s.listener != nil {
		return nil
	}

	host := facades.Config().GetString("tcp.navigation.host", "0.0.0.0")
	port := facades.Config().GetString("tcp.navigation.port", "8080")
	address := fmt.Sprintf("%s:%s", host, port)

	listener, err := net.Listen("tcp", address)
	if err != nil {
		facades.Log().Error("❌ Failed to start TCP server", err)
		return err
	}

	s.listener = listener
	facades.Log().Info(fmt.Sprintf("🚀 TCP Server listening on %s", address))

	// Start the disconnection checker
	s.CheckDisconnectedVessels()

	// Handle connections in a separate goroutine
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				if s.listener == nil {
					return
				}
				facades.Log().Error("⚠️ Accept error", err)
				continue
			}
			facades.Log().Info("✨ New connection from " + conn.RemoteAddr().String())
			go s.handleConnection(conn)
		}
	}()

	return nil
}

// Add this new method
func (s *TCPVesselService) markAllVesselsDisconnected() {
	var vessels []models.Kapal
	err := facades.Orm().Query().Where("record_status = ?", true).Find(&vessels)
	if err != nil {
		facades.Log().Error("Failed to fetch vessels for initial disconnect status:", err)
		return
	}

	for _, vessel := range vessels {
		var lastRecord models.VesselRecord
		err := facades.Orm().Query().
			Where("call_sign = ?", vessel.CallSign).
			Order("created_at DESC").
			First(&lastRecord)

		if err == nil {
			// Only update if the status isn't already disconnected
			if lastRecord.TelnetStatus != models.Disconnected {
				lastRecord.TelnetStatus = models.Disconnected
				err = facades.Orm().Query().Save(&lastRecord)
				if err != nil {
					facades.Log().Error(fmt.Sprintf("Failed to update initial status for %s: %v", vessel.CallSign, err))
					continue
				}
				facades.Log().Info(fmt.Sprintf("Marked vessel %s as disconnected on startup", vessel.CallSign))
			}
		}
	}
	facades.Log().Info("✅ Completed initial vessel status check")
}

func (s *TCPVesselService) CheckDisconnectedVessels() {
	go func() {
		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for range ticker.C {
			s.bufferMutex.Lock()
			now := time.Now()

			// Only check vessels we know are active
			for callSign, vessel := range s.activeVessels {
				buffer, exists := s.nmeaBuffers[callSign]
				if !exists {
					facades.Log().Debug(fmt.Sprintf("Vessel %s marked as disconnected - Buffer not found", callSign))
					s.updateLastRecordStatus(*vessel, "", models.Disconnected)
					delete(s.activeVessels, callSign)
					continue
				}

				// Check if vessel has exceeded timeout
				if now.Sub(buffer.LastGGATime) > disconnectTimeout {
					facades.Log().Debug(fmt.Sprintf("Vessel %s marked as disconnected - No data for %v",
						callSign,
						now.Sub(buffer.LastGGATime)))
					s.updateLastRecordStatus(*vessel, "", models.Disconnected)
					delete(s.nmeaBuffers, callSign) // Clean up the buffer
					delete(s.activeVessels, callSign)
				}
			}

			s.bufferMutex.Unlock()
		}
	}()
}

func (s *TCPVesselService) handleConnection(conn net.Conn) {
	defer func() {
		conn.Close()
		facades.Log().Info("👋 Connection closed: " + conn.RemoteAddr().String())
	}()

	buffer := make([]byte, 1024)
	for {
		n, err := conn.Read(buffer)
		if err != nil {
			if err.Error() != "EOF" {
				facades.Log().Error("💥 Read error", err)
			}
			return
		}

		data := string(buffer[:n])
		s.handleTCPData(data)

		_, err = conn.Write(buffer[:n])
		if err != nil {
			facades.Log().Error("📤 Write error", err)
			return
		}
	}
}

func (s *TCPVesselService) getKapal(callSign string) (*models.Kapal, error) {
	if entry, exists := s.cache[callSign]; exists {
		if time.Since(entry.timestamp) < cacheDuration {
			return entry.kapal, entry.error
		}
		delete(s.cache, callSign)
	}

	kapal := models.Kapal{}
	err := facades.Orm().Query().Where("call_sign = ?", callSign).FirstOrFail(&kapal)
	if err != nil {
		return nil, err // Return nil and the error
	}

	kapalPtr := &kapal
	s.cache[callSign] = &CacheEntry{
		kapal:     kapalPtr,
		error:     nil, // Set error to nil on success
		timestamp: time.Now(),
	}

	return kapalPtr, nil
}

// Update handleTCPData to track vessels
func (s *TCPVesselService) handleTCPData(data string) {
	// fmt.Println(data)
	parts := strings.Split(data, ",")
	if len(parts) < 2 {
		facades.Log().Error("❌ Invalid data format")
		return
	}

	id, lines := strings.TrimSpace(parts[0]), strings.Split(strings.TrimSpace(strings.Join(parts[1:], ",")), "\n")
	kapal, err := s.getKapal(id)

	for _, line := range lines {
		if err != nil {
			if err.Error() == "record not found" {
				facades.Log().Error("❌ Data not found for call sign: " + id)
				return
			}
			facades.Log().Error("❌ Database error", err)
			return
		}

		// Track this vessel as active
		s.trackVessel(kapal)

		s.processVesselData(*kapal, line)
	}
}

func (s *TCPVesselService) processVesselData(kapal models.Kapal, data string) {
	if len(data) >= 6 {
		sentenceType := data[3:6]
		switch sentenceType {
		case "GGA":
			s.processGGAData(kapal, data)
		case "HDT":
			s.processHDTData(kapal, data)
		case "VTG":
			s.processVTGData(kapal, data)
		case "DBT", "DPT":
			s.processDepthData(kapal, data)
		}
	}
}


func (s *TCPVesselService) processGGAData(kapal models.Kapal, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 15 {
		facades.Log().Debug(fmt.Sprintf("Invalid GGA sentence, padding with defaults: %s", data))
		fields = append(fields, make([]string, 15-len(fields))...) // Pad with empty strings
	}
	
	buffer := s.getOrCreateBuffer(kapal.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()
	
	// Default values
	latitude := "0.0"
	longitude := "0.0"
	
	// Parse latitude if available
	if fields[2] != "" && fields[3] != "" {
		latDMS, err := strconv.ParseFloat(fields[2], 64)
		if err == nil {
			latitude = formatCoordinate(latDMS, fields[3])
		} else {
			facades.Log().Debug(fmt.Sprintf("Error parsing latitude, using default 0: %v", err))
		}
	}
	
	// Parse longitude if available
	if fields[4] != "" && fields[5] != "" {
		longDMS, err := strconv.ParseFloat(fields[4], 64)
		if err == nil {
			longitude = formatCoordinate(longDMS, fields[5])
		} else {
			facades.Log().Debug(fmt.Sprintf("Error parsing longitude, using default 0: %v", err))
		}
	}
	
	// Default GPS quality to 0 if field is empty
	var gpsQuality models.GpsQuality
	if fields[6] != "" {
		gpsQuality = getGpsQualityFromIndicator(fields[6])
	}
	
	// Update buffer with new GGA data
	buffer.Latitude = latitude
	buffer.Longitude = longitude
	buffer.GpsQualityIndicator = gpsQuality
	buffer.LastGGATime = time.Now()
	
	// Check if we should create a record
	if kapal.RecordStatus && time.Since(buffer.LastRecordTime) >= time.Duration(kapal.HistoryPerSecond)*time.Second {
		timeSinceVTG := time.Since(buffer.LastVTGTime)
		facades.Log().Debug(fmt.Sprintf(
			"Creating record for %s - Current Speed: %.2f knots, Last VTG update: %v ago",
			kapal.CallSign,
			buffer.SpeedInKnots,
			timeSinceVTG,
		))
		s.createVesselRecord(kapal.CallSign, buffer, kapal.HistoryPerSecond)
		buffer.LastRecordTime = time.Now()
	}
}

func (s *TCPVesselService) createVesselRecord(callSign string, buffer *NMEABuffer, historyPerSecond int64) {
	// Only create record if we have the minimum required data
	if buffer.Latitude == "" || buffer.Longitude == "" {
		facades.Log().Debug(fmt.Sprintf("Skipping record creation for %s - missing position data", callSign))
		return
	}

	var lastRecord models.VesselRecord
	err := facades.Orm().Query().Where("call_sign = ?", callSign).Order("created_at DESC").First(&lastRecord)


	newRecord := &models.VesselRecord{
		CallSign:            callSign,
		Latitude:            buffer.Latitude,
		Longitude:           buffer.Longitude,
		HeadingDegree:       buffer.HeadingDegree,
		SpeedInKnots:        buffer.SpeedInKnots,
		GpsQualityIndicator: buffer.GpsQualityIndicator,
		WaterDepth:          buffer.WaterDepth,
		TelnetStatus:        models.Connected,
	}

	if err == nil {
		newRecord.SeriesID = lastRecord.SeriesID + 1
	} else {
		newRecord.SeriesID = 1
	}

	// Create new record
	err = facades.Orm().Query().Create(newRecord)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("Failed to create vessel record: %v", err))
	} else {
		facades.Log().Debug(fmt.Sprintf("Successfully created vessel record - CallSign: %s, Speed: %.2f, SeriesID: %d",
			callSign, newRecord.SpeedInKnots, newRecord.SeriesID))
	}
}

func (s *TCPVesselService) processHDTData(kapal models.Kapal, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 3 {
		facades.Log().Debug(fmt.Sprintf("Invalid HDT sentence, using default values: %s", data))
		fields = append(fields, make([]string, 3-len(fields))...) // Pad with empty strings
	}

	buffer := s.getOrCreateBuffer(kapal.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	// Default to 0 if field is empty or invalid
	heading := 0.0
	if fields[1] != "" {
		parsedHeading, err := strconv.ParseFloat(fields[1], 64)
		if err != nil {
			facades.Log().Debug(fmt.Sprintf("Error parsing heading, using default 0: %v", err))
		} else {
			heading = parsedHeading
		}
	}

	buffer.HeadingDegree = heading
	buffer.LastHDTTime = time.Now()
}

func (s *TCPVesselService) processVTGData(kapal models.Kapal, data string) {
	fields := strings.Split(strings.TrimSpace(data), ",")
	facades.Log().Debug(fmt.Sprintf("Processing VTG data for %s: %v", kapal.CallSign, fields))

	if len(fields) < 10 {
		facades.Log().Debug(fmt.Sprintf("Invalid VTG sentence, padding with defaults: %s", data))
		fields = append(fields, make([]string, 10-len(fields))...) // Pad with empty strings
	}

	buffer := s.getOrCreateBuffer(kapal.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	// Default to 0 if speed field is empty or invalid
	speedKnots := 0.0
	if fields[5] != "" {
		parsedSpeed, err := strconv.ParseFloat(strings.TrimSpace(fields[5]), 64)
		if err != nil {
			facades.Log().Debug(fmt.Sprintf("Error parsing speed, using default 0: %v", err))
		} else {
			speedKnots = parsedSpeed
		}
	}

	buffer.SpeedInKnots = speedKnots
	buffer.LastVTGTime = time.Now()
	facades.Log().Debug(fmt.Sprintf("Updated VTG speed for %s: %.2f knots", kapal.CallSign, speedKnots))
}

func (s *TCPVesselService) processDepthData(kapal models.Kapal, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 3 {
		facades.Log().Error("Invalid depth sentence")
		return
	}

	buffer := s.getOrCreateBuffer(kapal.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	depth, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		facades.Log().Error("Error parsing depth:", err)
		return
	}

	buffer.WaterDepth = depth
}

func (s *TCPVesselService) updateLastRecordStatus(kapal models.Kapal, data string, status models.TelnetStatus) {
	var lastRecord models.VesselRecord
	err := facades.Orm().Query().
		Where("call_sign = ?", kapal.CallSign).
		Order("created_at DESC").
		FirstOrFail(&lastRecord)

	if err != nil {
		facades.Log().Error(fmt.Sprintf("Failed to fetch last record for %s: %v", kapal.CallSign, err))
		return
	}

	// Only update if status is different
	if lastRecord.TelnetStatus != status {
		lastRecord.TelnetStatus = status
		err = facades.Orm().Query().Save(&lastRecord)
		if err != nil {
			facades.Log().Error(fmt.Sprintf("Failed to update status for %s: %v", kapal.CallSign, err))
			return
		}
		facades.Log().Debug(fmt.Sprintf("Updated last record status for %s to %s", kapal.CallSign, status))
	}
}

func (s *TCPVesselService) getOrCreateBuffer(callSign string) *NMEABuffer {
	s.bufferMutex.Lock()
	defer s.bufferMutex.Unlock()

	if buffer, exists := s.nmeaBuffers[callSign]; exists {
		return buffer
	}

	now := time.Now()
	buffer := &NMEABuffer{
		LastGGATime:    now,
		LastRecordTime: now,
		LastVTGTime:    now,
		LastHDTTime:    now,
		SpeedInKnots:   0,
		HeadingDegree:  0,
		WaterDepth:     0,
	}

	s.nmeaBuffers[callSign] = buffer
	return buffer
}

func (s *TCPVesselService) Stop() error {
	s.bufferMutex.Lock()
	defer s.bufferMutex.Unlock()

	// Mark all active vessels as disconnected before stopping
	for _, vessel := range s.activeVessels {
		s.updateLastRecordStatus(*vessel, "", models.Disconnected)
	}

	// Clear maps
	s.activeVessels = make(map[string]*models.Kapal)
	s.nmeaBuffers = make(map[string]*NMEABuffer)

	if s.listener != nil {
		return s.listener.Close()
	}
	return nil
}
