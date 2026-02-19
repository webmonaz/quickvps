package server

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"quickvps/internal/auth"
	"quickvps/internal/metrics"
	"quickvps/internal/ncdu"
	"quickvps/internal/ws"
)

const sessionCookieName = "quickvps_session"

type contextKey string

const sessionContextKey contextKey = "quickvps.session"

type Server struct {
	mux          *http.ServeMux
	collector    *metrics.Collector
	hub          *ws.Hub
	runner       *ncdu.Runner
	authDisabled bool
	authStore    *auth.Store
	sessions     *auth.SessionManager
	webFS        embed.FS
}

func New(
	collector *metrics.Collector,
	hub *ws.Hub,
	runner *ncdu.Runner,
	authDisabled bool,
	authStore *auth.Store,
	sessions *auth.SessionManager,
	webFS embed.FS,
) *Server {
	s := &Server{
		mux:          http.NewServeMux(),
		collector:    collector,
		hub:          hub,
		runner:       runner,
		authDisabled: authDisabled,
		authStore:    authStore,
		sessions:     sessions,
		webFS:        webFS,
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	webSub, err := fs.Sub(s.webFS, "web")
	if err != nil {
		log.Fatalf("failed to create web sub-filesystem: %v", err)
	}

	fileServer := http.FileServer(http.FS(webSub))

	s.mux.HandleFunc("/ws", s.handleWS)
	s.mux.HandleFunc("/api/info", s.handleInfo)
	s.mux.HandleFunc("/api/auth/login", s.handleAuthLogin)
	s.mux.HandleFunc("/api/auth/logout", s.handleAuthLogout)
	s.mux.HandleFunc("/api/auth/me", s.handleAuthMe)
	s.mux.HandleFunc("/api/users", s.handleUsers)
	s.mux.HandleFunc("/api/users/", s.handleUserByID)
	s.mux.HandleFunc("/api/audit/users", s.handleUserAudit)
	s.mux.HandleFunc("/api/interval", s.handleInterval)
	s.mux.HandleFunc("/api/metrics", s.handleMetrics)
	s.mux.HandleFunc("/api/ports", s.handlePorts)
	s.mux.HandleFunc("/api/ports/", s.handlePortByID)
	s.mux.HandleFunc("/api/ncdu/scan", s.handleNcduScan)
	s.mux.HandleFunc("/api/ncdu/cache", s.handleNcduCache)
	s.mux.HandleFunc("/api/ncdu/status", s.handleNcduStatus)
	s.mux.Handle("/", spaHandler(webSub, fileServer))
}

func (s *Server) Handler() http.Handler {
	var handler http.Handler = s.mux
	handler = loggingMiddleware(handler)
	if !s.authDisabled {
		handler = sessionAuthMiddleware(s, handler)
	}
	return handler
}

func spaHandler(webSub fs.FS, fileServer http.Handler) http.Handler {
	indexHTML, err := fs.ReadFile(webSub, "index.html")
	if err != nil {
		log.Fatalf("spaHandler: failed to read index.html: %v", err)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if f, err := webSub.Open(path); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(indexHTML)
	})
}

func sessionAuthMiddleware(s *Server, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		tokenCookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			writeUnauthorized(w)
			return
		}

		session, ok := s.sessions.Get(tokenCookie.Value)
		if !ok {
			writeUnauthorized(w)
			return
		}

		ctx := withSession(r.Context(), session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isPublicPath(path string) bool {
	if path == "/api/auth/login" {
		return true
	}
	if !strings.HasPrefix(path, "/api/") && path != "/ws" {
		return true
	}
	return false
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
}

func withSession(ctx context.Context, session auth.Session) context.Context {
	return context.WithValue(ctx, sessionContextKey, session)
}

func sessionFromContext(ctx context.Context) (auth.Session, bool) {
	session, ok := ctx.Value(sessionContextKey).(auth.Session)
	if !ok {
		return auth.Session{}, false
	}
	return session, true
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
