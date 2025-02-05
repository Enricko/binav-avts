package services

import (
    "fmt"
    "net"
    "strings"
    "regexp"
    "goravel/app/models"
    "github.com/goravel/framework/facades"
)

type TCPSensorService struct {
    listener net.Listener
}

func NewTCPSensorService() *TCPSensorService {
    return &TCPSensorService{}
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

		fmt.Println(data)

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
    // Extract sensor ID from message using regex
	fmt.Println(msg)
    re := regexp.MustCompile(`ID:(\d+)`)
    matches := re.FindStringSubmatch(msg)
    
    if len(matches) < 2 {
        facades.Log().Error("Could not extract sensor ID from message")
        return
    }

    sensorID := matches[1]
    
    // Check if sensor exists in database
    var sensor models.Sensor
    err := facades.Orm().Query().Where("id = ?", sensorID).FirstOrFail(&sensor)
    if err != nil {
        facades.Log().Error(fmt.Sprintf("Sensor not found: %s", sensorID))
        return
    }

    // Create sensor record
    record := &models.SensorRecord{
        IDSensor: sensorID,
        RawData:  msg,
    }

    err = facades.Orm().Query().Create(record)
    if err != nil {
        facades.Log().Error(fmt.Sprintf("Failed to create sensor record: %v", err))
        return
    }

    facades.Log().Info(fmt.Sprintf("Created record for sensor %s", sensorID))
}

func (s *TCPSensorService) Stop() error {
    if s.listener != nil {
        return s.listener.Close()
    }
    return nil
}