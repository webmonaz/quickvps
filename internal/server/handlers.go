package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"quickvps/internal/auth"
	"quickvps/internal/ncdu"
	"quickvps/internal/ports"
	"quickvps/internal/ws"
)

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) authRequired() bool {
	return !s.authDisabled
}

func (s *Server) currentSession(r *http.Request) (auth.Session, bool) {
	if !s.authRequired() {
		return auth.Session{}, false
	}
	return sessionFromContext(r.Context())
}

func (s *Server) currentUser(r *http.Request) (auth.User, bool) {
	session, ok := s.currentSession(r)
	if !ok {
		return auth.User{}, false
	}
	return auth.User{ID: session.UserID, Username: session.Username, Role: session.Role}, true
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) (auth.User, bool) {
	user, ok := s.currentUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return auth.User{}, false
	}
	if user.Role != auth.RoleAdmin {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return auth.User{}, false
	}
	return user, true
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.authDisabled {
		writeJSON(w, http.StatusOK, map[string]any{"auth_disabled": true})
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	user, err := s.authStore.Authenticate(body.Username, body.Password)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	session, err := s.sessions.Create(user)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create session"})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  session.ExpiresAt,
		Secure:   r.TLS != nil,
	})

	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.authDisabled {
		writeJSON(w, http.StatusOK, map[string]any{"auth_disabled": true})
		return
	}

	if tokenCookie, err := r.Cookie(sessionCookieName); err == nil {
		s.sessions.Delete(tokenCookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		Secure:   r.TLS != nil,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.authDisabled {
		writeJSON(w, http.StatusOK, map[string]any{"auth_disabled": true})
		return
	}

	user, ok := s.currentUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}

	switch r.Method {
	case http.MethodGet:
		users, err := s.authStore.ListUsers()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"users": users})

	case http.MethodPost:
		var body struct {
			Username string    `json:"username"`
			Password string    `json:"password"`
			Role     auth.Role `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		if body.Role == "" {
			body.Role = auth.RoleViewer
		}

		created, err := s.authStore.CreateUser(body.Username, body.Password, body.Role)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrUserExists),
				errors.Is(err, auth.ErrInvalidRole),
				errors.Is(err, auth.ErrInvalidUsername),
				errors.Is(err, auth.ErrInvalidPassword):
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			default:
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return
		}

		_ = s.authStore.LogUserAudit(
			admin.ID,
			admin.Username,
			"create_user",
			created.ID,
			created.Username,
			mustJSON(map[string]any{"role": created.Role}),
		)

		writeJSON(w, http.StatusCreated, map[string]any{"user": created})

	default:
		_ = admin
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleUserByID(w http.ResponseWriter, r *http.Request) {
	admin, ok := s.requireAdmin(w, r)
	if !ok {
		return
	}

	idPart := strings.TrimPrefix(r.URL.Path, "/api/users/")
	if idPart == "" || strings.Contains(idPart, "/") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	userID, err := strconv.ParseInt(idPart, 10, 64)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}

	switch r.Method {
	case http.MethodPut:
		var body struct {
			Role     *auth.Role `json:"role"`
			Password *string    `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
			return
		}

		updated, err := s.authStore.UpdateUser(userID, body.Role, body.Password)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrNotFound):
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			case errors.Is(err, auth.ErrInvalidRole),
				errors.Is(err, auth.ErrInvalidPassword),
				errors.Is(err, auth.ErrLastAdmin):
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			default:
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return
		}

		if body.Role != nil || body.Password != nil {
			s.sessions.DeleteByUserID(userID)
		}

		_ = s.authStore.LogUserAudit(
			admin.ID,
			admin.Username,
			"update_user",
			updated.ID,
			updated.Username,
			mustJSON(map[string]any{
				"role_changed":     body.Role != nil,
				"password_changed": body.Password != nil,
				"new_role":         updated.Role,
			}),
		)

		writeJSON(w, http.StatusOK, map[string]any{"user": updated})

	case http.MethodDelete:
		if admin.ID == userID {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot delete current user"})
			return
		}

		target, err := s.authStore.GetUserByID(userID)
		if err != nil {
			if errors.Is(err, auth.ErrNotFound) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if err := s.authStore.DeleteUser(userID); err != nil {
			if errors.Is(err, auth.ErrNotFound) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
				return
			}
			if errors.Is(err, auth.ErrLastAdmin) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		s.sessions.DeleteByUserID(userID)

		_ = s.authStore.LogUserAudit(
			admin.ID,
			admin.Username,
			"delete_user",
			target.ID,
			target.Username,
			mustJSON(map[string]any{"target_role": target.Role}),
		)

		writeJSON(w, http.StatusOK, map[string]any{"status": "deleted", "id": userID})

	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleUserAudit(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requireAdmin(w, r); !ok {
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid limit"})
			return
		}
		limit = parsed
	}

	entries, err := s.authStore.ListUserAudits(limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

var AppVersion = "dev"

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	hostname, _ := os.Hostname()
	localIP, publicIP := getLocalIPs()

	info := map[string]any{
		"hostname":           hostname,
		"os":                 runtime.GOOS,
		"arch":               runtime.GOARCH,
		"uptime":             getUptime(),
		"auth_enabled":       !s.authDisabled,
		"interval_ms":        s.collector.Interval().Milliseconds(),
		"ncdu_cache_ttl_sec": int64(s.runner.CacheTTL().Seconds()),
		"local_ip":           localIP,
		"public_ip":          publicIP,
		"dns_servers":        getDNSServers(),
		"version":            AppVersion,
	}
	writeJSON(w, http.StatusOK, info)
}

// getLocalIPs returns the primary local and public IPv4 addresses.
// On a VPS where a public IP is assigned directly to an interface, both may be
// the same value. On a NAT'd host the local IP will be a private RFC-1918
// address and public_ip will be empty / equal to local_ip.
func getLocalIPs() (localIP string, publicIP string) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "unknown", "unknown"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() || ip.To4() == nil {
				continue
			}
			if localIP == "" {
				localIP = ip.String()
			}
			if !isPrivateIP(ip) && publicIP == "" {
				publicIP = ip.String()
			}
		}
	}
	if localIP == "" {
		localIP = "unknown"
	}
	if publicIP == "" {
		publicIP = localIP
	}
	return
}

func isPrivateIP(ip net.IP) bool {
	privateCIDRs := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"100.64.0.0/10",
		"169.254.0.0/16",
	}
	for _, cidr := range privateCIDRs {
		_, block, err := net.ParseCIDR(cidr)
		if err == nil && block.Contains(ip) {
			return true
		}
	}
	return false
}

func getDNSServers() []string {
	data, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return nil
	}
	var servers []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "nameserver ") {
			server := strings.TrimSpace(strings.TrimPrefix(line, "nameserver "))
			if server != "" {
				servers = append(servers, server)
			}
		}
	}
	return servers
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
