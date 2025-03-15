package services

import (
	"fmt"
	"goravel/app/models"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/goravel/framework/facades"
)

// SensorBuffer holds current sensor data
type SensorBuffer struct {
	RawData        string
	LastUpdateTime time.Time
	LastRecordTime time.Time
	mutex          sync.Mutex
}

// TCPSensorService handles TCP connections for sensor data
type TCPSensorService struct {
	listener          net.Listener
	bufferMutex       sync.Mutex
	sensorBuffers     map[string]*SensorBuffer
	activeSensors     map[string]*models.Sensor
	ConnectionStatus  bool
	activeConnections int
	connMutex         sync.Mutex
}

// NewTCPSensorService creates a new TCP sensor service
func NewTCPSensorService() *TCPSensorService {
	return &TCPSensorService{
		sensorBuffers: make(map[string]*SensorBuffer),
		activeSensors: make(map[string]*models.Sensor),
	}
}

// GetSensorBuffers returns the current sensor buffers
func (s *TCPSensorService) GetSensorBuffers() map[string]*SensorBuffer {
	s.bufferMutex.Lock()
	defer s.bufferMutex.Unlock()
	return s.sensorBuffers
}

// GetBufferMutex returns the buffer mutex
func (s *TCPSensorService) GetBufferMutex() *sync.Mutex {
	return &s.bufferMutex
}

// Start initializes the TCP sensor server
func (s *TCPSensorService) Start() error {
	host := facades.Config().GetString("tcp.sensor.host", "0.0.0.0")
	port := facades.Config().GetString("tcp.sensor.port", "8085")
	address := fmt.Sprintf("%s:%s", host, port)

	listener, err := net.Listen("tcp", address)
	if err != nil {
		s.ConnectionStatus = false
		facades.Log().Error("Failed to start TCP server", err)
		return err
	}

	s.listener = listener
	facades.Log().Info(fmt.Sprintf("TCP Sensor Server listening on %s", address))

	go s.handleConnections()
	return nil
}

// handleConnections accepts and processes incoming connections
func (s *TCPSensorService) handleConnections() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			if s.listener == nil {
				s.ConnectionStatus = false // Update status when listener is closed
				return
			}
			facades.Log().Error("Accept error", err)
			s.ConnectionStatus = false // Update status on connection error
			continue
		}
		s.ConnectionStatus = true // Connection successful
		facades.Log().Info("New sensor connection from " + conn.RemoteAddr().String())
		go s.handleConnection(conn)
	}
}

// handleConnection processes a single TCP connection
func (s *TCPSensorService) handleConnection(conn net.Conn) {
	s.incrementConnections()
	defer func() {
		conn.Close()
		s.decrementConnections()
	}()

	var dataBuffer strings.Builder
	buffer := make([]byte, 1024)

	for {
		n, err := conn.Read(buffer)
		if err != nil {
			return
		}
		dataBuffer.Write(buffer[:n])
		data := dataBuffer.String()

		if strings.Contains(data, "\n") {
			messages := strings.Split(data, "\n")
			for _, msg := range messages[:len(messages)-1] {
				if msg = strings.TrimSpace(msg); msg != "" {
					s.processMessage(msg)
				}
			}
			dataBuffer.Reset()
			if lastMsg := strings.TrimSpace(messages[len(messages)-1]); lastMsg != "" {
				dataBuffer.WriteString(lastMsg)
			}
		}
	}
}

// incrementConnections increases the active connection count
func (s *TCPSensorService) incrementConnections() {
	s.connMutex.Lock()
	defer s.connMutex.Unlock()
	s.activeConnections++
}

// decrementConnections decreases the active connection count
func (s *TCPSensorService) decrementConnections() {
	s.connMutex.Lock()
	defer s.connMutex.Unlock()
	s.activeConnections--
	if s.activeConnections == 0 {
		s.ConnectionStatus = false
	}
}

// extractTimestamp attempts to extract a timestamp from the raw sensor data
// This function searches for a pattern like "TS:yyyy-mm-dd HH:MM:SS" in the raw data
func extractTimestamp(rawData string) (time.Time, error) {
	// Regex to match a timestamp in the format "TS:2023-01-01 12:34:56" or similar format
	re := regexp.MustCompile(`TS:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})`)
	matches := re.FindStringSubmatch(rawData)

	if len(matches) < 2 {
		return time.Time{}, fmt.Errorf("timestamp not found in raw data")
	}

	// Parse the timestamp
	timestamp, err := time.Parse("2006-01-02 15:04:05", matches[1])
	if err != nil {
		return time.Time{}, fmt.Errorf("failed to parse timestamp: %v", err)
	}

	return timestamp, nil
}

// processMessage handles an incoming sensor message
func (s *TCPSensorService) processMessage(msg string) {
	re := regexp.MustCompile(`ID:(\d+)`)
	matches := re.FindStringSubmatch(msg)

	if len(matches) < 2 {
		facades.Log().Error("Could not extract sensor ID from message")
		return
	}

	sensorID := matches[1]

	var sensor models.Sensor
	// We should apply the soft-delete filter here if the Sensor model uses soft deletes
	err := facades.Orm().Query().Where("id = ?", sensorID).FirstOrFail(&sensor)
	if err != nil {
		facades.Log().Error(fmt.Sprintf("Sensor not found: %s", sensorID))
		return
	}

	buffer := s.getOrCreateBuffer(sensorID)
	buffer.mutex.Lock()
	defer buffer.mutex.Unlock()

	buffer.RawData = msg
	buffer.LastUpdateTime = time.Now()

	if time.Since(buffer.LastRecordTime) >= time.Second {
		// Extract timestamp from raw data
		timestamp, err := extractTimestamp(buffer.RawData)
		if err != nil {
			facades.Log().Warning(fmt.Sprintf("Could not extract timestamp from sensor data: %v. Using current time instead.", err))
			timestamp = time.Now()
		}

		record := &models.SensorRecord{
			IDSensor:  sensorID,
			RawData:   buffer.RawData,
			CreatedAt: timestamp, // Use the extracted timestamp for created_at
			UpdatedAt: timestamp, // Use the same timestamp for updated_at
		}

		err = facades.Orm().Query().Create(record)
		if err != nil {
			facades.Log().Error(fmt.Sprintf("Failed to create sensor record: %v", err))
			return
		}

		buffer.LastRecordTime = time.Now()
		// facades.Log().Info(fmt.Sprintf("Created record for sensor %s", sensorID))
	}
}

// getOrCreateBuffer gets or creates a buffer for a sensor
func (s *TCPSensorService) getOrCreateBuffer(sensorID string) *SensorBuffer {
	s.bufferMutex.Lock()
	defer s.bufferMutex.Unlock()

	if buffer, exists := s.sensorBuffers[sensorID]; exists {
		return buffer
	}

	now := time.Now()
	buffer := &SensorBuffer{
		LastUpdateTime: now,
		LastRecordTime: now,
	}

	s.sensorBuffers[sensorID] = buffer
	return buffer
}

// Stop gracefully shuts down the TCP sensor server
func (s *TCPSensorService) Stop() error {
	if s.listener != nil {
		s.ConnectionStatus = false // Update status on stop
		return s.listener.Close()
	}
	return nil
}
