package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"quickvps/internal/alerts"
	"quickvps/internal/auth"
	"quickvps/internal/metrics"
	"quickvps/internal/ncdu"
	"quickvps/internal/server"
	"quickvps/internal/ws"
)

//go:embed web
var webFS embed.FS

func main() {
	addr := flag.String("addr", ":8080", "Listen address")
	authEnabled := flag.Bool("auth", false, "Enable user management and login")
	user := flag.String("user", "admin", "Initial admin username when auth is enabled")
	password := flag.String("password", "", "Initial admin password when auth is enabled")
	dbPath := flag.String("db", "quickvps.db", "SQLite database path")
	interval := flag.Duration("interval", 2*time.Second, "Metrics push interval")
	flag.Parse()

	if v := strings.TrimSpace(os.Getenv("QUICKVPS_AUTH")); v != "" {
		if parsed, err := strconv.ParseBool(v); err == nil {
			*authEnabled = parsed
		}
	}

	// Fall back to environment variables
	if *user == "admin" {
		if v := os.Getenv("QUICKVPS_USER"); v != "" {
			*user = v
		}
	}
	if *password == "" {
		if v := os.Getenv("QUICKVPS_PASSWORD"); v != "" {
			*password = v
		}
	}

	bootstrapPassword := strings.TrimSpace(*password)

	log.Printf("Starting QuickVPS on %s (interval=%s)", *addr, *interval)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	collector := metrics.NewCollector(*interval)
	hub := ws.NewHub()
	runner := ncdu.NewRunner()

	var (
		authStore    *auth.Store
		sessionStore *auth.SessionManager
		alertStore   *alerts.Store
		alertService *alerts.Service
	)

	as, err := alerts.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("failed to initialize alert store: %v", err)
	}
	alertStore = as
	defer alertStore.Close() //nolint:errcheck

	alertService, err = alerts.NewService(alertStore, alerts.NewNotifier(), strings.TrimSpace(os.Getenv("QUICKVPS_ALERTS_KEY")))
	if err != nil {
		log.Fatalf("failed to initialize alert service: %v", err)
	}

	if *authEnabled {
		if bootstrapPassword == "" {
			bootstrapPassword = "admin123"
			log.Printf("WARNING: No bootstrap password provided; using first-run default credentials %q/%q", *user, bootstrapPassword)
		}

		store, err := auth.NewStore(*dbPath)
		if err != nil {
			log.Fatalf("failed to initialize auth store: %v", err)
		}
		authStore = store
		sessionStore = auth.NewSessionManager(24*time.Hour, authStore)

		if err := authStore.SeedAdmin(*user, bootstrapPassword); err != nil {
			log.Fatalf("failed to seed admin user: %v", err)
		}
		defer authStore.Close() //nolint:errcheck
	} else {
		log.Println("Auth mode is DISABLED (public access). Start with --auth=true to enable user management and login.")
	}

	// Start background goroutines
	go collector.Run(ctx)
	go hub.Run(ctx)
	go alertService.Run(ctx, collector.Subscribe())

	// Bridge: collector → hub (broadcast Snapshot as JSON)
	go func() {
		ch := collector.Subscribe()
		for {
			select {
			case <-ctx.Done():
				return
			case snap, ok := <-ch:
				if !ok {
					return
				}
				msg := buildWSMessage(snap, runner.IsReady())
				hub.Broadcast(msg)
			}
		}
	}()

	srv := server.New(collector, hub, runner, alertService, !*authEnabled, authStore, sessionStore, webFS)

	httpServer := &http.Server{
		Addr:         *addr,
		Handler:      srv.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Listening on http://localhost%s", *addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	httpServer.Shutdown(shutCtx) //nolint:errcheck
}

type wsMessage struct {
	Type      string      `json:"type"`
	Snapshot  interface{} `json:"snapshot"`
	NcduReady bool        `json:"ncdu_ready"`
}

func buildWSMessage(snap interface{}, ncduReady bool) []byte {
	b, _ := json.Marshal(wsMessage{
		Type:      "metrics",
		Snapshot:  snap,
		NcduReady: ncduReady,
	})
	return b
}
