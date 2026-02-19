package server

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"time"

	"quickvps/internal/metrics"
	"quickvps/internal/ncdu"
	"quickvps/internal/ws"
)

type Server struct {
	mux       *http.ServeMux
	collector *metrics.Collector
	hub       *ws.Hub
	runner    *ncdu.Runner
	user      string
	password  string
	webFS     embed.FS
}

func New(
	collector *metrics.Collector,
	hub *ws.Hub,
	runner *ncdu.Runner,
	user, password string,
	webFS embed.FS,
) *Server {
	s := &Server{
		mux:       http.NewServeMux(),
		collector: collector,
		hub:       hub,
		runner:    runner,
		user:      user,
		password:  password,
		webFS:     webFS,
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
	s.mux.HandleFunc("/api/metrics", s.handleMetrics)
	s.mux.HandleFunc("/api/ncdu/scan", s.handleNcduScan)
	s.mux.HandleFunc("/api/ncdu/status", s.handleNcduStatus)
	s.mux.Handle("/", fileServer)
}

func (s *Server) Handler() http.Handler {
	var handler http.Handler = s.mux
	handler = loggingMiddleware(handler)
	if s.password != "" {
		handler = basicAuthMiddleware(s.user, s.password, handler)
	}
	return handler
}

func basicAuthMiddleware(user, pass string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, p, ok := r.BasicAuth()
		if !ok || u != user || p != pass {
			w.Header().Set("WWW-Authenticate", `Basic realm="quickvps"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
