package services

import (
	"bufio"
	"context"
	"fmt"
	"goravel/app/models"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/goravel/framework/facades"
)


type TelnetService struct {
	ctx         context.Context
	cancel      context.CancelFunc
	sessions    map[uint]*TelnetConnection
	nmeaBuffers map[string]*NMEABuffer // key is CallSign
	mu          sync.RWMutex
	bufferMutex sync.RWMutex
	isRunning   bool
}

type TelnetConnection struct {
	Session *models.TelnetSession
	Conn    net.Conn
	Context context.Context
	Cancel  context.CancelFunc
}

// NewTelnetService creates a new telnet service instance
func NewTelnetService() *TelnetService {
	ctx, cancel := context.WithCancel(context.Background())
	return &TelnetService{
		ctx:         ctx,
		cancel:      cancel,
		sessions:    make(map[uint]*TelnetConnection),
		nmeaBuffers: make(map[string]*NMEABuffer),
	}
}

// GetBufferMutex returns the buffer mutex
func (ts *TelnetService) GetBufferMutex() *sync.RWMutex {
	return &ts.bufferMutex
}

// GetNMEABuffers returns the NMEA buffers map
func (ts *TelnetService) GetNMEABuffers() map[string]*NMEABuffer {
	return ts.nmeaBuffers
}

// Add this method to NMEABuffer
func (b *NMEABuffer) GetMutex() *sync.Mutex {
	return &b.mutex
}

// Start initializes and runs the telnet service
func (ts *TelnetService) Start() error {
	ts.mu.Lock()
	if ts.isRunning {
		ts.mu.Unlock()
		return fmt.Errorf("telnet service is already running")
	}
	ts.isRunning = true
	ts.mu.Unlock()

	// Start monitoring for sessions in background
	go ts.monitorSessions()

	// Start buffer cleanup routine
	go ts.cleanupOldBuffers()

	return nil
}

// monitorSessions continuously checks for telnet sessions
func (ts *TelnetService) monitorSessions() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial check
	ts.updateSessions()

	for {
		select {
		case <-ts.ctx.Done():
			return
		case <-ticker.C:
			ts.updateSessions()
		}
	}
}

// updateSessions checks and updates active telnet sessions
func (ts *TelnetService) updateSessions() {
	var sessions []models.TelnetSession
	err := facades.Orm().Query().Find(&sessions)
	if err != nil {
		facades.Log().Error("Failed to fetch telnet sessions:", err)
		return
	}

	ts.mu.Lock()
	defer ts.mu.Unlock()

	currentSessions := make(map[uint]bool)

	for _, session := range sessions {
		currentSessions[session.ID] = true

		if conn, exists := ts.sessions[session.ID]; exists {
			// Check if connection details changed
			if conn.Session.IP != session.IP || conn.Session.Port != session.Port {
				ts.stopSession(session.ID)
				ts.startSession(&session)
			}
		} else {
			// Start new session
			ts.startSession(&session)
		}
	}

	// Clean up old sessions
	for id := range ts.sessions {
		if !currentSessions[id] {
			ts.stopSession(id)
		}
	}
}

// startSession initiates a new telnet connection
func (ts *TelnetService) startSession(session *models.TelnetSession) {
	ctx, cancel := context.WithCancel(ts.ctx)

	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", session.IP, session.Port), 10*time.Second)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("Failed to connect to %s:%d: %v", session.IP, session.Port, err))
		cancel()
		return
	}

	tc := &TelnetConnection{
		Session: session,
		Conn:    conn,
		Context: ctx,
		Cancel:  cancel,
	}

	ts.sessions[session.ID] = tc

	go ts.readTelnetData(tc)
}

// readTelnetData reads data from telnet connection
func (ts *TelnetService) readTelnetData(tc *TelnetConnection) {
	defer func() {
		fmt.Printf("Closing connection for %s (IP: %s:%d)\n", tc.Session.Name, tc.Session.IP, tc.Session.Port)

		// Update the last record status to Disconnected
		if tc.Session.CallSign != nil {
			ts.updateLastRecordStatus(*tc.Session.CallSign, models.Disconnected)
		}

		tc.Conn.Close()
		tc.Cancel()
		ts.mu.Lock()
		delete(ts.sessions, tc.Session.ID)
		ts.mu.Unlock()
	}()

	fmt.Printf("Started reading data from %s (IP: %s:%d)\n", tc.Session.Name, tc.Session.IP, tc.Session.Port)

	reader := bufio.NewReader(tc.Conn)
	for {
		// Set a short read deadline to prevent blocking
		tc.Conn.SetReadDeadline(time.Now().Add(1 * time.Second))

		select {
		case <-tc.Context.Done():
			return
		default:
			line, err := reader.ReadString('\n')
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					// Just a timeout, continue reading
					continue
				}
				fmt.Printf("Read error for %s: %v\n", tc.Session.Name, err)
				return
			}

			if line = strings.TrimSpace(line); line != "" {
				// fmt.Printf("📡 [%s] Raw data received: %s\n", tc.Session.Name, line)
				ts.processData(tc.Session, line)
			}
		}
	}
}

func (ts *TelnetService) updateLastRecordStatus(callSign string, status models.TelnetStatus) {
	var lastRecord models.VesselRecord
	err := facades.Orm().Query().
		Where("call_sign = ?", callSign).
		Order("created_at DESC").
		First(&lastRecord)

	if err != nil {
		facades.Log().Error(fmt.Sprintf("Failed to fetch last record for %s: %v", callSign, err))
		return
	}

	// Only update if status is different
	if lastRecord.TelnetStatus != status {
		lastRecord.TelnetStatus = status
		err = facades.Orm().Query().Save(&lastRecord)
		if err != nil {
			facades.Log().Error(fmt.Sprintf("Failed to update status for %s: %v", callSign, err))
			return
		}
		facades.Log().Debug(fmt.Sprintf("Updated last record status for %s to %s", callSign, status))
	}
}

// processData handles incoming telnet data
func (ts *TelnetService) processData(session *models.TelnetSession, data string) {
	// Create telnet record
	record := &models.TelnetRecord{
		IDTelnet: uint64(session.ID),
		RawData:  data,
	}

	// Handle NMEA data if applicable
	if session.TypeIP != nil && ts.isNMEAData(data) {
		ts.processNMEAData(session, data)
	} else {
		err := facades.Orm().Query().Create(record)
		if err != nil {
			facades.Log().Error(fmt.Sprintf("Failed to save telnet record: %v", err))
			return
		}
	}
}

// isNMEAData checks if data is NMEA format
func (ts *TelnetService) isNMEAData(data string) bool {
	return len(data) > 0 && data[0] == '$' && len(data) > 6
}

// processNMEAData handles NMEA format data
func (ts *TelnetService) processNMEAData(session *models.TelnetSession, data string) {
	if session.TypeIP == nil {
		return
	}

	typeIP := *session.TypeIP
	if typeIP == "all" {
		// For "all" type, determine the sentence type and process accordingly
		if len(data) >= 6 {
			sentenceType := data[3:6]
			switch sentenceType {
			case "GGA":
				ts.processGGAData(session, data)
			case "HDT":
				ts.processHDTData(session, data)
			case "VTG":
				ts.processVTGData(session, data)
			case "DBT", "DPT":
				ts.processDepthData(session, data)
			}
		}
	} else if ts.shouldProcessNMEAType(data, typeIP) {
		// Process specific type as before
		switch typeIP {
		case "gga":
			ts.processGGAData(session, data)
		case "hdt":
			ts.processHDTData(session, data)
		case "vtg":
			ts.processVTGData(session, data)
		case "depth":
			ts.processDepthData(session, data)
		}
	}
}

func (ts *TelnetService) processGGAData(session *models.TelnetSession, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 15 {
		facades.Log().Error("Invalid GGA sentence")
		return
	}

	buffer := ts.getOrCreateBuffer(*session.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	// Parse and update GGA data as before
	latDMS, err := strconv.ParseFloat(fields[2], 64)
	if err != nil {
		facades.Log().Error("Error parsing latitude:", err)
		return
	}
	latDir := fields[3]

	longDMS, err := strconv.ParseFloat(fields[4], 64)
	if err != nil {
		facades.Log().Error("Error parsing longitude:", err)
		return
	}
	longDir := fields[5]

	latitude := formatCoordinate(latDMS, latDir)
	longitude := formatCoordinate(longDMS, longDir)
	gpsQuality := getGpsQualityFromIndicator(fields[6])

	// Fetch Kapal data
	var kapal models.Kapal
	err = facades.Orm().Query().Where("call_sign = ?", *session.CallSign).First(&kapal)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("Failed to fetch kapal data for %s: %v", *session.CallSign, err))
		return
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
			*session.CallSign,
			buffer.SpeedInKnots,
			timeSinceVTG,
		))

		ts.createVesselRecord(*session.CallSign, buffer, kapal.HistoryPerSecond)
		buffer.LastRecordTime = time.Now()
	}
}

func (ts *TelnetService) processHDTData(session *models.TelnetSession, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 3 {
		facades.Log().Error("Invalid HDT sentence")
		return
	}

	buffer := ts.getOrCreateBuffer(*session.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	heading, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		facades.Log().Error("Error parsing heading:", err)
		return
	}

	// Store the heading and update timestamp
	buffer.HeadingDegree = heading
	buffer.LastHDTTime = time.Now()
}

func (ts *TelnetService) processVTGData(session *models.TelnetSession, data string) {
	fields := strings.Split(strings.TrimSpace(data), ",")

	// Debug log the incoming VTG data
	facades.Log().Debug(fmt.Sprintf("Processing VTG data for %s: %v", *session.CallSign, fields))

	// VTG has 10 fields including the sentence ID
	if len(fields) < 6 {
		facades.Log().Error(fmt.Sprintf("Invalid VTG sentence (not enough fields): %s", data))
		return
	}

	// Speed is in field 5 (index 5)
	speedField := strings.TrimSpace(fields[5])
	if speedField == "" {
		facades.Log().Debug(fmt.Sprintf("Empty speed field in VTG data for %s", *session.CallSign))
		return
	}

	buffer := ts.getOrCreateBuffer(*session.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	speedKnots, err := strconv.ParseFloat(speedField, 64)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("Error parsing speed from VTG data: %v, Speed field: %s", err, speedField))
		return
	}

	// Update the buffer with the new speed
	buffer.SpeedInKnots = speedKnots
	buffer.LastVTGTime = time.Now()

	facades.Log().Debug(fmt.Sprintf("Updated VTG speed for %s: %.2f knots", *session.CallSign, speedKnots))
}

func (ts *TelnetService) processDepthData(session *models.TelnetSession, data string) {
	fields := strings.Split(data, ",")
	if len(fields) < 3 {
		facades.Log().Error("Invalid depth sentence")
		return
	}

	buffer := ts.getOrCreateBuffer(*session.CallSign)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	depth, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		facades.Log().Error("Error parsing depth:", err)
		return
	}

	buffer.WaterDepth = depth
}

func (ts *TelnetService) getOrCreateBuffer(callSign string) *NMEABuffer {
	ts.bufferMutex.Lock()
	defer ts.bufferMutex.Unlock()

	if buffer, exists := ts.nmeaBuffers[callSign]; exists {
		return buffer
	}

	now := time.Now()
	buffer := &NMEABuffer{
		LastGGATime:    now,
		LastRecordTime: now,
		LastVTGTime:    now, // Initialize to current time instead of zero time
		LastHDTTime:    now, // Initialize to current time
		SpeedInKnots:   0,
		HeadingDegree:  0,
		WaterDepth:     0,
	}

	ts.nmeaBuffers[callSign] = buffer
	return buffer
}

func (ts *TelnetService) createVesselRecord(callSign string, buffer *NMEABuffer, historyPerSecond int64) {
	// Only create record if we have the minimum required data
	if buffer.Latitude == "" || buffer.Longitude == "" {
		facades.Log().Debug(fmt.Sprintf("Skipping record creation for %s - missing position data", callSign))
		return
	}

	var lastRecord models.VesselRecord
	err := facades.Orm().Query().Where("call_sign = ?", callSign).Order("created_at DESC").First(&lastRecord)

	// Debug log all values before creating record
	facades.Log().Debug(fmt.Sprintf(
		"Creating vessel record for %s:\n"+
			"Speed: %.2f knots\n"+
			"Position: %s, %s\n"+
			"Heading: %.2f\n"+
			"Last VTG update: %v ago",
		callSign,
		buffer.SpeedInKnots,
		buffer.Latitude,
		buffer.Longitude,
		buffer.HeadingDegree,
		time.Since(buffer.LastVTGTime),
	))

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

func (ts *TelnetService) updateVesselRecord(callSign string, updateFn func(*models.VesselRecord)) {
	var lastRecord models.VesselRecord
	err := facades.Orm().Query().Where("call_sign = ?", callSign).Order("created_at DESC").First(&lastRecord)

	newRecord := &models.VesselRecord{
		CallSign:     callSign,
		TelnetStatus: models.Connected,
	}

	if err == nil {
		// Copy existing values
		newRecord.Latitude = lastRecord.Latitude
		newRecord.Longitude = lastRecord.Longitude
		newRecord.HeadingDegree = lastRecord.HeadingDegree
		newRecord.SpeedInKnots = lastRecord.SpeedInKnots
		newRecord.WaterDepth = lastRecord.WaterDepth
		newRecord.GpsQualityIndicator = lastRecord.GpsQualityIndicator
		newRecord.SeriesID = lastRecord.SeriesID + 1
	} else {
		newRecord.SeriesID = 1
	}

	// Apply updates
	updateFn(newRecord)

	// Create new record
	err = facades.Orm().Query().Create(newRecord)
	if err != nil {
		facades.Log().Error("Failed to create vessel record:", err)
	}
}

func formatCoordinate(dms float64, direction string) string {
	degrees := int(dms / 100)
	minutes := dms - float64(degrees*100)
	return fmt.Sprintf("%d°%.4f°%s", degrees, minutes, direction)
}

func (ts *TelnetService) shouldProcessNMEAType(data string, typeIP string) bool {
	if len(data) < 6 {
		return false
	}

	switch typeIP {
	case "gga":
		return data[3:6] == "GGA"
	case "hdt":
		return data[3:6] == "HDT"
	case "vtg":
		return data[3:6] == "VTG"
	case "depth":
		return data[3:6] == "DBT" || data[3:6] == "DPT"
	default:
		return false
	}
}

// Stop stops the telnet service
func (ts *TelnetService) Stop() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if !ts.isRunning {
		return
	}

	ts.cancel()

	// Close all active connections
	for id := range ts.sessions {
		ts.stopSession(id)
	}

	ts.isRunning = false
}

// stopSession stops a specific session
func (ts *TelnetService) stopSession(sessionID uint) {
	if conn, exists := ts.sessions[sessionID]; exists {
		if conn.Session.CallSign != nil {
			ts.updateLastRecordStatus(*conn.Session.CallSign, models.Disconnected)
		}
		conn.Cancel()
		conn.Conn.Close()
		delete(ts.sessions, sessionID)
	}
}

func (ts *TelnetService) cleanupOldBuffers() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ts.ctx.Done():
			return
		case <-ticker.C:
			ts.bufferMutex.Lock()
			for callSign, buffer := range ts.nmeaBuffers {
				buffer.mutex.Lock()
				if time.Since(buffer.LastGGATime) > 10*time.Minute {
					delete(ts.nmeaBuffers, callSign)
				}
				buffer.mutex.Unlock()
			}
			ts.bufferMutex.Unlock()
		}
	}
}

func getGpsQualityFromIndicator(indicator string) models.GpsQuality {
	switch indicator {
	case "0":
		return models.FixNotValid
	case "1":
		return models.GpsFix
	case "2":
		return models.DifferentialGpsFix
	case "3":
		return models.NotApplicable
	case "4":
		return models.RtkFixed
	case "5":
		return models.RtkFloat
	case "6":
		return models.InsDeadReckoning
	default:
		return models.NotApplicable
	}
}
