package server

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"strings"
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
	s.mux.HandleFunc("/api/interval", s.handleInterval)
	s.mux.HandleFunc("/api/metrics", s.handleMetrics)
	s.mux.HandleFunc("/api/ncdu/scan", s.handleNcduScan)
	s.mux.HandleFunc("/api/ncdu/cache", s.handleNcduCache)
	s.mux.HandleFunc("/api/ncdu/status", s.handleNcduStatus)
	s.mux.Handle("/", spaHandler(webSub, fileServer))
}

func (s *Server) Handler() http.Handler {
	var handler http.Handler = s.mux
	handler = loggingMiddleware(handler)
	if s.password != "" {
		handler = basicAuthMiddleware(s.user, s.password, handler)
	}
	return handler
}

// spaHandler serves static files and falls back to index.html for SPA routes.
func spaHandler(webSub fs.FS, fileServer http.Handler) http.Handler {
	// Pre-read index.html once for fast fallback responses.
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
		// File not found — serve index.html so React Router handles the route.
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(indexHTML)
	})
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
