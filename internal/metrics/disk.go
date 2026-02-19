package metrics

import (
	"github.com/shirou/gopsutil/v3/disk"
)

func collectDisks() []DiskMetrics {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil
	}

	var result []DiskMetrics
	seen := make(map[string]bool)

	for _, p := range partitions {
		if seen[p.Device] {
			continue
		}
		seen[p.Device] = true

		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		result = append(result, DiskMetrics{
			Mountpoint: p.Mountpoint,
			Device:     p.Device,
			Fstype:     p.Fstype,
			TotalBytes: usage.Total,
			UsedBytes:  usage.Used,
			FreeBytes:  usage.Free,
			Percent:    usage.UsedPercent,
		})
	}

	return result
}

type diskIOCounter struct {
	readBytes  uint64
	writeBytes uint64
	readCount  uint64
	writeCount uint64
}

func collectDiskIO() map[string]diskIOCounter {
	counters, err := disk.IOCounters()
	if err != nil {
		return nil
	}

	result := make(map[string]diskIOCounter)
	for name, c := range counters {
		result[name] = diskIOCounter{
			readBytes:  c.ReadBytes,
			writeBytes: c.WriteBytes,
			readCount:  c.ReadCount,
			writeCount: c.WriteCount,
		}
	}
	return result
}

func calcDiskIO(prev, curr map[string]diskIOCounter, elapsed float64) []DiskIOMetrics {
	if elapsed <= 0 {
		return nil
	}

	var result []DiskIOMetrics
	for name, c := range curr {
		p, ok := prev[name]
		if !ok {
			continue
		}
		result = append(result, DiskIOMetrics{
			Device:   name,
			ReadBps:  float64(c.readBytes-p.readBytes) / elapsed,
			WriteBps: float64(c.writeBytes-p.writeBytes) / elapsed,
			ReadOps:  float64(c.readCount-p.readCount) / elapsed,
			WriteOps: float64(c.writeCount-p.writeCount) / elapsed,
		})
	}
	return result
}
