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
	"syscall"
	"time"

	"quickvps/internal/metrics"
	"quickvps/internal/ncdu"
	"quickvps/internal/server"
	"quickvps/internal/ws"
)

//go:embed web
var webFS embed.FS

func main() {
	addr     := flag.String("addr", ":8080", "Listen address")
	user     := flag.String("user", "admin", "Basic auth username")
	password := flag.String("password", "", "Basic auth password (empty = disabled)")
	interval := flag.Duration("interval", 2*time.Second, "Metrics push interval")
	flag.Parse()

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

	if *password == "" {
		log.Println("WARNING: No password set — authentication is DISABLED")
	}

	log.Printf("Starting QuickVPS on %s (interval=%s)", *addr, *interval)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	collector := metrics.NewCollector(*interval)
	hub       := ws.NewHub()
	runner    := ncdu.NewRunner()

	// Start background goroutines
	go collector.Run(ctx)
	go hub.Run(ctx)

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

	srv := server.New(collector, hub, runner, *user, *password, webFS)

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
