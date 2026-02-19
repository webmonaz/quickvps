package metrics

import (
	"github.com/shirou/gopsutil/v3/net"
)

type netCounter struct {
	bytesRecv uint64
	bytesSent uint64
}

func collectNet() map[string]netCounter {
	counters, err := net.IOCounters(true)
	if err != nil {
		return nil
	}

	result := make(map[string]netCounter)
	for _, c := range counters {
		result[c.Name] = netCounter{
			bytesRecv: c.BytesRecv,
			bytesSent: c.BytesSent,
		}
	}
	return result
}

func calcNet(prev, curr map[string]netCounter, elapsed float64) []NetMetrics {
	if elapsed <= 0 {
		return nil
	}

	var result []NetMetrics
	for name, c := range curr {
		p, ok := prev[name]
		if !ok {
			continue
		}
		result = append(result, NetMetrics{
			Interface: name,
			RecvBps:   float64(c.bytesRecv-p.bytesRecv) / elapsed,
			SentBps:   float64(c.bytesSent-p.bytesSent) / elapsed,
			TotalRecv: c.bytesRecv,
			TotalSent: c.bytesSent,
		})
	}
	return result
}
