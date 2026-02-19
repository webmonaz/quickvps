package ncdu

import (
	"context"
	"log"
	"os/exec"
	"sync"
	"time"
)

type Runner struct {
	mu     sync.RWMutex
	result ScanResult
	cancel context.CancelFunc
}

func NewRunner() *Runner {
	return &Runner{
		result: ScanResult{Status: StatusIdle},
	}
}

func (r *Runner) Start(path string) error {
	r.mu.Lock()

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
	r.mu.Unlock()

	go r.run(ctx, path)
	return nil
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

func (r *Runner) setError(msg string) {
	r.mu.Lock()
	r.result.Status = StatusError
	r.result.Error = msg
	r.mu.Unlock()
}
