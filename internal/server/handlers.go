package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"time"

	"quickvps/internal/ws"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	hostname, _ := os.Hostname()

	info := map[string]any{
		"hostname": hostname,
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
		"uptime":   getUptime(),
	}
	writeJSON(w, http.StatusOK, info)
}

func getUptime() string {
	// Read /proc/uptime on Linux
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "unknown"
	}
	var uptimeSec float64
	if _, err := fmt.Sscanf(string(data), "%f", &uptimeSec); err != nil {
		return "unknown"
	}
	d := time.Duration(uptimeSec) * time.Second
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	snap := s.collector.Latest()
	if snap == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "no data yet"})
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	client, err := ws.NewClient(s.hub, w, r)
	if err != nil {
		http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
		return
	}
	go client.Run()
}

func (s *Server) handleNcduScan(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var body struct {
			Path string `json:"path"`
		}
		body.Path = "/"
		json.NewDecoder(r.Body).Decode(&body)
		if body.Path == "" {
			body.Path = "/"
		}
		if err := s.runner.Start(body.Path); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "started", "path": body.Path})

	case http.MethodDelete:
		s.runner.Cancel()
		writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleNcduStatus(w http.ResponseWriter, r *http.Request) {
	result := s.runner.Result()
	writeJSON(w, http.StatusOK, result)
}
