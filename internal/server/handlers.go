package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"quickvps/internal/ncdu"
	"quickvps/internal/ports"
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
		"hostname":           hostname,
		"os":                 runtime.GOOS,
		"arch":               runtime.GOARCH,
		"uptime":             getUptime(),
		"interval_ms":        s.collector.Interval().Milliseconds(),
		"ncdu_cache_ttl_sec": int64(s.runner.CacheTTL().Seconds()),
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
		mode, err := s.runner.Start(body.Path)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if mode == ncdu.StartModeCached {
			writeJSON(w, http.StatusOK, map[string]string{"status": "cached", "path": body.Path})
			return
		}
		if mode == ncdu.StartModeRunning {
			writeJSON(w, http.StatusAccepted, map[string]string{"status": "running", "path": body.Path})
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

func (s *Server) handleNcduCache(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		ttl := s.runner.CacheTTL()
		writeJSON(w, http.StatusOK, map[string]any{
			"cache_ttl_sec": int64(ttl.Seconds()),
			"cache_ttl":     ttl.String(),
		})

	case http.MethodPut:
		var body struct {
			CacheTTLSec int64 `json:"cache_ttl_sec"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.CacheTTLSec <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cache_ttl_sec must be > 0"})
			return
		}

		ttl := time.Duration(body.CacheTTLSec) * time.Second
		if err := s.runner.SetCacheTTL(ttl); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"cache_ttl_sec": int64(ttl.Seconds()),
			"cache_ttl":     ttl.String(),
		})

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handlePorts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	listeners, err := ports.ListListeners()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"listeners": listeners,
	})
}

func (s *Server) handlePortByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	portPart := strings.TrimPrefix(r.URL.Path, "/api/ports/")
	if portPart == "" || strings.Contains(portPart, "/") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid port"})
		return
	}

	port, err := strconv.Atoi(portPart)
	if err != nil || port <= 0 || port > 65535 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid port"})
		return
	}

	killed, killErr := ports.KillByPort(port)
	if killErr != nil {
		if errors.Is(killErr, ports.ErrNoProcessOnPort) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": killErr.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error":       killErr.Error(),
			"killed_pids": killed,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "killed",
		"port":        port,
		"killed_pids": killed,
	})
}

func (s *Server) handleInterval(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		d := s.collector.Interval()
		writeJSON(w, http.StatusOK, map[string]any{
			"interval_ms": d.Milliseconds(),
			"interval":    d.String(),
		})

	case http.MethodPut:
		var body struct {
			IntervalMS int64 `json:"interval_ms"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}
		if body.IntervalMS <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "interval_ms must be > 0"})
			return
		}

		interval := time.Duration(body.IntervalMS) * time.Millisecond
		if err := s.collector.SetInterval(interval); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"interval_ms": interval.Milliseconds(),
			"interval":    interval.String(),
		})

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}
