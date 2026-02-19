package ncdu

import (
	"context"
	"errors"
	"log"
	"os/exec"
	"sync"
	"time"
)

const defaultCacheTTL = 10 * time.Minute

type StartMode string

const (
	StartModeStarted StartMode = "started"
	StartModeRunning StartMode = "running"
	StartModeCached  StartMode = "cached"
)

type Runner struct {
	mu       sync.RWMutex
	result   ScanResult
	cancel   context.CancelFunc
	cacheTTL time.Duration
}

func NewRunner() *Runner {
	return &Runner{
		result:   ScanResult{Status: StatusIdle},
		cacheTTL: defaultCacheTTL,
	}
}

func (r *Runner) Start(path string) (StartMode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.result.Status == StatusDone &&
		r.result.Path == path &&
		time.Since(r.result.ScannedAt) <= r.cacheTTL {
		return StartModeCached, nil
	}

	if r.result.Status == StatusRunning && r.result.Path == path {
		return StartModeRunning, nil
	}

	// Cancel any running scan
	if r.cancel != nil {
		r.cancel()
	}

	r.result = ScanResult{
		Path:   path,
		Status: StatusRunning,
	}

	ctx, cancel := context.WithCancel(context.Background())
	r.cancel = cancel

	go r.run(ctx, path)
	return StartModeStarted, nil
}

func (r *Runner) run(ctx context.Context, path string) {
	// Ensure ncdu is installed
	if !IsInstalled() {
		log.Println("ncdu not found, attempting to install...")
		if err := Install(); err != nil {
			r.setError("ncdu not installed and auto-install failed: " + err.Error())
			return
		}
	}

	cmd := exec.CommandContext(ctx, "ncdu", "-1", "-x", "-o", "-", path)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		r.setError("failed to create stdout pipe: " + err.Error())
		return
	}

	if err := cmd.Start(); err != nil {
		r.setError("failed to start ncdu: " + err.Error())
		return
	}

	root, parseErr := Parse(stdout)

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			// Cancelled by user
			r.mu.Lock()
			r.result.Status = StatusIdle
			r.mu.Unlock()
			return
		}
		if parseErr != nil {
			r.setError("ncdu failed: " + err.Error())
			return
		}
	}

	if parseErr != nil {
		r.setError("parse ncdu output: " + parseErr.Error())
		return
	}

	var totalSize int64
	if root != nil {
		totalSize = root.DiskSize
	}

	r.mu.Lock()
	r.result = ScanResult{
		Path:      path,
		ScannedAt: time.Now(),
		TotalSize: totalSize,
		Root:      root,
		Status:    StatusDone,
	}
	r.mu.Unlock()
}

func (r *Runner) Cancel() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cancel != nil {
		r.cancel()
		r.cancel = nil
	}
	r.result.Status = StatusIdle
}

func (r *Runner) Result() ScanResult {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.result
}

func (r *Runner) IsReady() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.result.Status == StatusDone
}

func (r *Runner) CacheTTL() time.Duration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.cacheTTL
}

func (r *Runner) SetCacheTTL(ttl time.Duration) error {
	if ttl <= 0 {
		return errors.New("cache ttl must be greater than zero")
	}

	r.mu.Lock()
	r.cacheTTL = ttl
	r.mu.Unlock()
	return nil
}

func (r *Runner) setError(msg string) {
	r.mu.Lock()
	r.result.Status = StatusError
	r.result.Error = msg
	r.mu.Unlock()
}
