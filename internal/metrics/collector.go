package metrics

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
)

type Collector struct {
	mu         sync.RWMutex
	latest     *Snapshot
	prevDiskIO map[string]diskIOCounter
	prevNet    map[string]netCounter
	prevTime   time.Time
	interval   time.Duration
	intervalMu sync.RWMutex
	intervalCh chan time.Duration
	subs       []chan *Snapshot
	subsMu     sync.Mutex
}

func NewCollector(interval time.Duration) *Collector {
	// Warm up CPU meter with a blocking sample
	cpu.Percent(200*time.Millisecond, false)

	c := &Collector{
		interval:   interval,
		intervalCh: make(chan time.Duration, 1),
		prevDiskIO: collectDiskIO(),
		prevNet:    collectNet(),
		prevTime:   time.Now(),
	}
	return c
}

func (c *Collector) Run(ctx context.Context) {
	ticker := time.NewTicker(c.Interval())
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case next := <-c.intervalCh:
			ticker.Reset(next)
		case t := <-ticker.C:
			snap := c.collect(t)
			c.mu.Lock()
			c.latest = snap
			c.mu.Unlock()

			c.subsMu.Lock()
			for _, ch := range c.subs {
				select {
				case ch <- snap:
				default:
				}
			}
			c.subsMu.Unlock()
		}
	}
}

func (c *Collector) collect(now time.Time) *Snapshot {
	elapsed := now.Sub(c.prevTime).Seconds()

	cpuM := collectCPU()
	memM, swapM := collectMemory()
	disks := collectDisks()
	currDiskIO := collectDiskIO()
	currNet := collectNet()

	diskIO := calcDiskIO(c.prevDiskIO, currDiskIO, elapsed)
	network := calcNet(c.prevNet, currNet, elapsed)

	c.prevDiskIO = currDiskIO
	c.prevNet = currNet
	c.prevTime = now

	return &Snapshot{
		Timestamp: now,
		CPU:       cpuM,
		Memory:    memM,
		Swap:      swapM,
		Disks:     disks,
		DiskIO:    diskIO,
		Network:   network,
	}
}

func (c *Collector) Latest() *Snapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.latest
}

func (c *Collector) Subscribe() <-chan *Snapshot {
	ch := make(chan *Snapshot, 4)
	c.subsMu.Lock()
	c.subs = append(c.subs, ch)
	c.subsMu.Unlock()
	return ch
}

func (c *Collector) Unsubscribe(ch <-chan *Snapshot) {
	c.subsMu.Lock()
	defer c.subsMu.Unlock()
	for i, s := range c.subs {
		if s == ch {
			c.subs = append(c.subs[:i], c.subs[i+1:]...)
			return
		}
	}
}

func (c *Collector) Interval() time.Duration {
	c.intervalMu.RLock()
	defer c.intervalMu.RUnlock()
	return c.interval
}

func (c *Collector) SetInterval(interval time.Duration) error {
	if interval <= 0 {
		return errors.New("interval must be greater than zero")
	}

	c.intervalMu.Lock()
	if c.interval == interval {
		c.intervalMu.Unlock()
		return nil
	}
	c.interval = interval
	c.intervalMu.Unlock()

	select {
	case c.intervalCh <- interval:
	default:
		select {
		case <-c.intervalCh:
		default:
		}
		select {
		case c.intervalCh <- interval:
		default:
		}
	}

	return nil
}
