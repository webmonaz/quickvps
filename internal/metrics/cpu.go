package metrics

import (
	"github.com/shirou/gopsutil/v3/cpu"
)

func collectCPU() CPUMetrics {
	m := CPUMetrics{}

	percents, err := cpu.Percent(0, false)
	if err == nil && len(percents) > 0 {
		m.TotalPercent = percents[0]
	}

	perCore, err := cpu.Percent(0, true)
	if err == nil {
		m.PerCore = perCore
		m.CoreCount = len(perCore)
	}

	infos, err := cpu.Info()
	if err == nil && len(infos) > 0 {
		m.ModelName = infos[0].ModelName
		m.FreqMHz = infos[0].Mhz
	}

	return m
}
