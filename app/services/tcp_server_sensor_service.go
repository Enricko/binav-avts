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

type SensorBuffer struct {
    RawData        string
    LastUpdateTime time.Time
    LastRecordTime time.Time
    mutex          sync.Mutex
}

type TCPSensorService struct {
    listener     net.Listener
    bufferMutex  sync.Mutex
    sensorBuffers map[string]*SensorBuffer  // key is sensor ID
    activeSensors map[string]*models.Sensor // Track active sensors
}

func NewTCPSensorService() *TCPSensorService {
    return &TCPSensorService{
        sensorBuffers: make(map[string]*SensorBuffer),
        activeSensors: make(map[string]*models.Sensor),
    }
}

func (s *TCPSensorService) GetSensorBuffers() map[string]*SensorBuffer {
    s.bufferMutex.Lock()
    defer s.bufferMutex.Unlock()
    return s.sensorBuffers
}

func (s *TCPSensorService) GetBufferMutex() *sync.Mutex {
    return &s.bufferMutex
}


func (s *TCPSensorService) Start() error {
    host := facades.Config().GetString("tcp.sensor.host", "0.0.0.0")
    port := facades.Config().GetString("tcp.sensor.port", "8085")
    address := fmt.Sprintf("%s:%s", host, port)

    listener, err := net.Listen("tcp", address)
    if err != nil {
        facades.Log().Error("Failed to start TCP server", err)
        return err
    }

    s.listener = listener
    facades.Log().Info(fmt.Sprintf("TCP Sensor Server listening on %s", address))

    go s.handleConnections()
    return nil
}

func (s *TCPSensorService) handleConnections() {
    for {
        conn, err := s.listener.Accept()
        if err != nil {
            if s.listener == nil {
                return
            }
            facades.Log().Error("Accept error", err)
            continue
        }
        facades.Log().Info("New sensor connection from " + conn.RemoteAddr().String())
        go s.handleConnection(conn)
    }
}

func (s *TCPSensorService) handleConnection(conn net.Conn) {
    defer conn.Close()

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

func (s *TCPSensorService) processMessage(msg string) {
    re := regexp.MustCompile(`ID:(\d+)`)
    matches := re.FindStringSubmatch(msg)
    
    if len(matches) < 2 {
        facades.Log().Error("Could not extract sensor ID from message")
        return
    }

    sensorID := matches[1]
    
    var sensor models.Sensor
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
        record := &models.SensorRecord{
            IDSensor: sensorID,
            RawData:  buffer.RawData,
        }

        err = facades.Orm().Query().Create(record)
        if err != nil {
            facades.Log().Error(fmt.Sprintf("Failed to create sensor record: %v", err))
            return
        }

        buffer.LastRecordTime = time.Now()
        facades.Log().Info(fmt.Sprintf("Created record for sensor %s", sensorID))
    }
}

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

func (s *TCPSensorService) Stop() error {
    if s.listener != nil {
        return s.listener.Close()
    }
    return nil
}