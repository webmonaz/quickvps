package metrics

import "time"

type Snapshot struct {
	Timestamp time.Time      `json:"timestamp"`
	CPU       CPUMetrics     `json:"cpu"`
	Memory    MemMetrics     `json:"memory"`
	Swap      SwapMetrics    `json:"swap"`
	Disks     []DiskMetrics  `json:"disks"`
	DiskIO    []DiskIOMetrics `json:"disk_io"`
	Network   []NetMetrics   `json:"network"`
}

type CPUMetrics struct {
	TotalPercent float64   `json:"total_percent"`
	FreqMHz      float64   `json:"freq_mhz"`
	PerCore      []float64 `json:"per_core"`
	CoreCount    int       `json:"core_count"`
	ModelName    string    `json:"model_name"`
}

type MemMetrics struct {
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Cached     uint64  `json:"cached"`
	Buffers    uint64  `json:"buffers"`
	Percent    float64 `json:"percent"`
}

type SwapMetrics struct {
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Percent    float64 `json:"percent"`
}

type DiskMetrics struct {
	Mountpoint string  `json:"mountpoint"`
	Device     string  `json:"device"`
	Fstype     string  `json:"fstype"`
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Percent    float64 `json:"percent"`
}

type DiskIOMetrics struct {
	Device   string  `json:"device"`
	ReadBps  float64 `json:"read_bps"`
	WriteBps float64 `json:"write_bps"`
	ReadOps  float64 `json:"read_ops"`
	WriteOps float64 `json:"write_ops"`
}

type NetMetrics struct {
	Interface string  `json:"interface"`
	RecvBps   float64 `json:"recv_bps"`
	SentBps   float64 `json:"sent_bps"`
	TotalRecv uint64  `json:"total_recv"`
	TotalSent uint64  `json:"total_sent"`
}
