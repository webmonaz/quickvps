package ncdu

import "time"

type ScanStatus string

const (
	StatusIdle    ScanStatus = "idle"
	StatusRunning ScanStatus = "running"
	StatusDone    ScanStatus = "done"
	StatusError   ScanStatus = "error"
)

type DirEntry struct {
	Name      string      `json:"name"`
	AllocSize int64       `json:"asize"`
	DiskSize  int64       `json:"dsize"`
	IsDir     bool        `json:"is_dir"`
	Children  []*DirEntry `json:"children,omitempty"`
}

type ScanResult struct {
	Path      string     `json:"path"`
	ScannedAt time.Time  `json:"scanned_at"`
	TotalSize int64      `json:"total_size"`
	Root      *DirEntry  `json:"root"`
	Status    ScanStatus `json:"status"`
	Error     string     `json:"error,omitempty"`
}
