package services

import (
	"goravel/app/models"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/goravel/framework/facades"
)

type TCPService struct {
	listener net.Listener
	mutex    sync.Mutex
	cache    map[string]*CacheEntry
}

type CacheEntry struct {
	kapal     *models.Kapal
	error     error
	timestamp time.Time
}

const cacheDuration = 1 * time.Minute

func NewTCPService() *TCPService {
	return &TCPService{
		cache: make(map[string]*CacheEntry),
	}
}

func (s *TCPService) Start() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.listener != nil {
		return nil
	}

	listener, err := net.Listen("tcp", "0.0.0.0:8080")
	if err != nil {
		facades.Log().Error("❌ Failed to start TCP server", err)
		return err
	}

	s.listener = listener
	facades.Log().Info("🚀 TCP Server listening on :8080")

	for {
		conn, err := listener.Accept()
		if err != nil {
			facades.Log().Error("⚠️ Accept error", err)
			continue
		}
		facades.Log().Info("✨ New connection from " + conn.RemoteAddr().String())
		go s.handleConnection(conn)
	}
}

func (s *TCPService) handleConnection(conn net.Conn) {
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

func (s *TCPService) getKapal(callSign string) (*models.Kapal, error) {
	if entry, exists := s.cache[callSign]; exists {
		if time.Since(entry.timestamp) < cacheDuration {
			return entry.kapal, entry.error
		}
		delete(s.cache, callSign)
	}

	kapal := &models.Kapal{}
	err := facades.Orm().Query().Where("call_sign = ?", callSign).FirstOrFail(&kapal)

	s.cache[callSign] = &CacheEntry{
		kapal:     kapal,
		error:     err,
		timestamp: time.Now(),
	}

	return kapal, err
}

func (s *TCPService) handleTCPData(data string) {
	parts := strings.Split(data, ",")
	if len(parts) < 2 {
		facades.Log().Error("❌ Invalid data format")
		return
	}

	id, data := parts[0], parts[1]
	kapal, err := s.getKapal(id)

	if err != nil {
		if err.Error() == "record not found" {
			facades.Log().Error("❌ Data not found for call sign: " + id)
			return
		}
		facades.Log().Error("❌ Database error", err)
		return
	}

	facades.Log().Info("📝 Data received for: " + kapal.CallSign)
}
